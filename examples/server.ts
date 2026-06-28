import { parse } from "node:url";
import {
  createServer,
  Server,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import next from "next";
import { WebSocket, WebSocketServer } from "ws";
import { Socket } from "node:net";
import { chatProc, onRoomEvent } from "@/lib/rpc/actions";
import { applyWSHandler } from "@/dist/adapters/ws";

const SERVER_PORT = 3000;
const nextApp = next({ dev: process.env.NODE_ENV !== "production" });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const server: Server = createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      handle(req, res, parse(req.url || "", true));
    },
  );

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    (ws as any).req = req; // Attach request to client to keep track of connection URL
    const { pathname, query } = parse(req.url || "", true);
    console.log(
      `WS client connected to ${pathname} (${wss.clients.size} total)`,
    );

    if (pathname === "/api/ws/room") {
      const roomId = (query.roomId as string) || "lobby";
      applyWSHandler(onRoomEvent({ roomId }), {
        ws,
        broadcast: (data: any) => {
          const payload =
            typeof data === "object" ? JSON.stringify(data) : String(data);
          wss.clients.forEach((client) => {
            const clientReq = (client as any).req;
            if (
              client !== ws &&
              client.readyState === WebSocket.OPEN &&
              clientReq &&
              clientReq.url === req.url
            ) {
              client.send(payload);
            }
          });
        },
      });
    } else {
      applyWSHandler(chatProc(), {
        ws,
        // Broadcast to everyone EXCEPT this client (the sender will use send()) on the same URL
        broadcast: (data: any) => {
          const payload =
            typeof data === "object" ? JSON.stringify(data) : String(data);
          wss.clients.forEach((client) => {
            const clientReq = (client as any).req;
            if (
              client !== ws &&
              client.readyState === WebSocket.OPEN &&
              clientReq &&
              clientReq.url === req.url
            ) {
              client.send(payload);
            }
          });
        },
      });
    }
  });

  server.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const { pathname } = parse(req.url || "/", true);

    if (pathname === "/_next/webpack-hmr") {
      nextApp.getUpgradeHandler()(req, socket, head);
    }

    if (pathname === "/api/ws" || pathname === "/api/ws/room") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  });

  server.listen(SERVER_PORT);
  console.log(`Server listening on port ${SERVER_PORT}`);
});

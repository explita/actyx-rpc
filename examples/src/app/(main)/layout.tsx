import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Type-Safe Procedures',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Declare inputs and outputs using Zod, Arktype, Valibot, and more. Actyx automatically validates payloads and infers strong TypeScript typings.
      </>
    ),
  },
  {
    title: 'Automatic Caching & State',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Built-in garbage collection, stale-time invalidation, and seamless integration with React&apos;s <code>useSyncExternalStore</code> out-of-the-box.
      </>
    ),
  },
  {
    title: 'Client-Side CRUD Mutations',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Mutate infinite/paginated cache collections instantly with <code>updateItem</code>, <code>removeItem</code>, and automatic optimistic rollbacks.
      </>
    ),
  },
  {
    title: 'Real-Time WebSockets',
    Svg: require('@site/static/img/logo.svg').default,
    description: (
      <>
        Expose topic-based socket subscriptions with <code>.subscription()</code> and bi-directional channels with <code>.ws()</code>.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--3')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

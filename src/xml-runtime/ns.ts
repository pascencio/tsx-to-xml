export type Namespace = {
    [tag: string]: () => string;
  };
  
  export function ns(prefix: string): Namespace {
    return new Proxy<Namespace>({} as Namespace, {
      get(_, tag: string) {
        return () => `${prefix}:${tag}`;
      }
    });
  }
  
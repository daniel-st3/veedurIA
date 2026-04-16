declare module "d3-force-3d" {
  export function forceCollide(
    radius?: number | ((node: any) => number),
  ): {
    strength(value: number): any;
    iterations(value: number): any;
  };

  export function forceX(
    x?: number | ((node: any) => number),
  ): {
    strength(value: number): any;
  };

  export function forceY(
    y?: number | ((node: any) => number),
  ): {
    strength(value: number): any;
  };
}

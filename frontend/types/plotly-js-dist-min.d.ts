declare module "plotly.js-dist-min" {
  const Plotly: {
    downloadImage: (
      graphDiv: unknown,
      options: {
        format?: string;
        filename?: string;
        width?: number;
        height?: number;
      }
    ) => Promise<string>;
  };

  export default Plotly;
}

// Import "?worker&url" do Vite: caminho do arquivo do Worker gerado no build.
declare module '*?worker&url' {
  const url: string;
  export default url;
}

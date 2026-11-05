/**
 * Contenedor único de la app: la barra superior y cada vista lo usan, así sus bordes coinciden.
 * Ancho fluido, centrado; el contenido (tarjetas y controles de la barra) llega a lo sumo a 1168px
 * (1216px menos el margen de 24px a cada lado).
 */
const PageContainer = ({ as: Tag = 'div', className = '', children, ...props }) => (
  <Tag className={`w-full max-w-[1216px] mx-auto px-4 lg:px-6 ${className}`} {...props}>
    {children}
  </Tag>
);

export default PageContainer;

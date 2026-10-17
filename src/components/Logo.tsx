/**
 * El lockup existe en dos versiones porque el lettering es negro en el
 * original: sobre fondo oscuro desaparecería. La llama conserva su color en
 * ambas. Relación de aspecto 2.513:1.
 */
export function Logo({
  width = 190,
  className,
}: {
  width?: number;
  className?: string;
}) {
  return (
    <picture className={className}>
      <source srcSet="/logo-dark.png" media="(prefers-color-scheme: dark)" />
      <img
        src="/logo-light.png"
        alt="Luz Admirable"
        width={width}
        height={Math.round((width / 2.5135) * 100) / 100}
        style={{ width, height: "auto", display: "block" }}
      />
    </picture>
  );
}

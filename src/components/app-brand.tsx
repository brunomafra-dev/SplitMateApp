type AppBrandProps = {
  className?: string
  iconClassName?: string
  textClassName?: string
}

export default function AppBrand({
  className = '',
  iconClassName = 'w-6 h-6',
  textClassName = 'text-2xl font-bold text-[#5BC5A7]',
}: AppBrandProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src="/logo/SplitMate-icon.png" alt="SplitMate" className={`${iconClassName} object-contain`} />
      <span className={textClassName}>SplitMate</span>
    </div>
  )
}

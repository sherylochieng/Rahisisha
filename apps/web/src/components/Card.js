// Card — reusable card component used across the landing page
// Props control everything — the same component renders different content
// This is the core principle of reusable components: shape stays the same, content changes

export default function Card({
  icon,        // SVG icon element passed from parent
  title,       // card heading
  description, // card body text
  variant = 'light', // 'light' (white card) or 'dark' (navy card)
  className = '',    // extra classes from parent for layout overrides
}) {
  const isLight = variant === 'light';

  return (
    <div
      className={`
        rounded-2xl p-8 transition-all duration-300
        hover:-translate-y-1 hover:shadow-xl
        ${isLight
          ? 'bg-white border border-gray-100 hover:border-brand-orange/20 hover:shadow-orange-100'
          : 'bg-brand-navy-light border border-white/10 hover:border-brand-orange/30 hover:shadow-brand-navy'
        }
        ${className}
      `}
      // hover:-translate-y-1 — card lifts slightly on hover
      // hover:shadow-xl — shadow deepens on hover
      // Conditional classes based on variant prop
    >
      {/* Icon container */}
      {icon && (
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${isLight ? 'bg-brand-cream' : 'bg-white/10'}`}>
          {/* bg-brand-cream — light orange tint background for icon on light cards */}
          {/* bg-white/10 — subtle white tint for icon on dark cards */}
          <div className="w-6 h-6 text-brand-orange">
            {icon}
          </div>
        </div>
      )}

      {/* Title */}
      <h3 className={`font-display font-semibold text-lg mb-3 ${isLight ? 'text-brand-navy' : 'text-white'}`}>
        {title}
      </h3>

      {/* Description */}
      <p className={`text-sm leading-relaxed ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
        {description}
      </p>
    </div>
  );
}
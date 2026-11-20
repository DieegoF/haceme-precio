import React, { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Galería deslizable con el dedo (scroll-snap), con flechas en compu y puntitos.
export default function Gallery({ photos = [], alt = "" }) {
  const ref = useRef(null);
  const [i, setI] = useState(0);
  const go = (n) => { const el = ref.current; if (!el) return; el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" }); };
  const onScroll = () => { const el = ref.current; if (el) setI(Math.round(el.scrollLeft / el.clientWidth)); };
  if (!photos.length) return <div className="aspect-square w-full bg-zinc-100" />;
  return (
    <div className="relative bg-zinc-100">
      <div ref={ref} onScroll={onScroll} className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((src, n) => (
          <img key={src} src={src} alt={`${alt} · foto ${n + 1}`} loading={n ? "lazy" : "eager"} className="h-full w-full shrink-0 snap-center object-cover" />
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button onClick={() => go(Math.max(0, i - 1))} aria-label="Foto anterior" className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow sm:flex"><ChevronLeft size={18} /></button>
          <button onClick={() => go(Math.min(photos.length - 1, i + 1))} aria-label="Foto siguiente" className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow sm:flex"><ChevronRight size={18} /></button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {photos.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-white" : "w-1.5 bg-white/60"}`} />)}
          </div>
          <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">{i + 1}/{photos.length}</span>
        </>
      )}
    </div>
  );
}

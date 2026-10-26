"use client";
/* oxlint-disable next/no-img-element -- Display the already optimized uploaded image directly. */
import { ArrowRight, MessageCircle, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { detailFields, type Product } from "@/lib/catalog-data";
import {
  whatsappNumber,
  type CommercialContact,
} from "@/lib/catalog-config";
import { similarProducts } from "@/lib/catalog-discovery";
import { complementProducts } from "@/lib/complements";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { ProductCard } from "./product-card";

const RELATED_LIMIT = 8;

export function ProductDetailsDialog({
  selected,
  onSelect,
  items,
  contact,
  style,
}: {
  selected: Product | null;
  onSelect: (product: Product | null) => void;
  items: Product[];
  contact: CommercialContact;
  style?: CSSProperties;
}) {
  // Até 8 parecidos (mesma linha de produto primeiro, como no app). Se
  // faltarem, completa com o que acompanha o item (macarrão → molho...).
  const { similar, complements } = useMemo(() => {
    if (!selected) return { similar: [], complements: [] };
    const found = similarProducts(items, selected, RELATED_LIMIT);
    return {
      similar: found,
      complements: complementProducts(
        items,
        selected,
        RELATED_LIMIT - found.length,
        new Set(found.map((p) => p.id)),
      ),
    };
  }, [items, selected]);
  // The content scrolls inside this box so the close button stays visible
  // outside it. Focusing the box on open keeps the sheet at the top instead of
  // jumping to the first similar product (the first tabbable element).
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [selected?.id]);
  return (
    <Dialog open={!!selected} onOpenChange={(open) => !open && onSelect(null)}>
      <DialogContent
        className="product-dialog"
        style={style}
        initialFocus={scroller}
      >
        <div ref={scroller} className="product-dialog-scroll" tabIndex={-1}>
          {selected && (
            <>
              <div className="dialog-product-top">
                <div className="dialog-product-media">
                  {selected.image ? (
                    <img src={selected.image} alt={selected.name} />
                  ) : (
                    <div className="missing-image">
                      <Package /> Imagem não cadastrada
                    </div>
                  )}
                </div>
                <div className="dialog-product-info">
                  <DialogHeader>
                    <span className="eyebrow">
                      {selected.brand} · {selected.code}
                    </span>
                    <DialogTitle>{selected.name}</DialogTitle>
                    <DialogDescription>
                      {selected.description ||
                        "Consulte os dados de embalagem e identificação deste produto."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="path-chip">
                    {selected.department} / {selected.section} /{" "}
                    {selected.category}
                  </div>
                  <p className="segment-label">Segmento: {selected.segment}</p>
                  <ul className="spec-list">
                    {selected.specs.map((s, i) => (
                      <li key={`${selected.id}-${i}-${s}`}>{s}</li>
                    ))}
                  </ul>
                  <dl className="product-specifications">
                    {detailFields
                      .filter(
                        ([key]) =>
                          key !== "supplier" && selected.details?.[key],
                      )
                      .map(([key, label]) => (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd>{selected.details?.[key]}</dd>
                        </div>
                      ))}
                  </dl>
                  {contact.whatsapp || contact.email ? (
                    <div className="product-contact-actions">
                      {contact.whatsapp && (
                        <a
                          className="primary-action whatsapp-action"
                          href={`https://wa.me/${whatsappNumber(contact.whatsapp)}?text=${encodeURIComponent(`Olá! Quero informações sobre ${selected.name} (código ${selected.code}).`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="size-4" /> Falar no WhatsApp
                        </a>
                      )}
                      {contact.email && (
                        <a
                          className={
                            contact.whatsapp
                              ? "secondary-action"
                              : "primary-action"
                          }
                          href={`mailto:${contact.email}?subject=${encodeURIComponent(`Informações sobre ${selected.name} (${selected.code})`)}`}
                        >
                          Solicitar por e-mail{" "}
                          <ArrowRight className="size-4" />
                        </a>
                      )}
                    </div>
                  ) : null}
                  {contact.phone && (
                    <p className="product-contact-phone">
                      Telefone comercial:{" "}
                      <a href={`tel:+${whatsappNumber(contact.phone)}`}>
                        {contact.phone}
                      </a>
                    </p>
                  )}
                  {!contact.whatsapp && !contact.email && !contact.phone && (
                    <p className="contact-empty">
                      Contato comercial ainda não cadastrado.
                    </p>
                  )}
                </div>
              </div>
              <div className="similar-block">
                <span className="eyebrow">
                  Mesma seção, categoria ou aplicação
                </span>
                <h3>Itens similares</h3>
                {similar.length ? (
                  <div className="similar-grid">
                    {similar.map((p) => (
                      <ProductCard key={p.id} product={p} onOpen={onSelect} />
                    ))}
                  </div>
                ) : (
                  <p>Ainda não há itens similares publicados.</p>
                )}
              </div>
              {complements.length > 0 && (
                <div className="similar-block">
                  <span className="eyebrow">
                    Para usar junto ou na mesma receita
                  </span>
                  <h3>Combina com este produto</h3>
                  <div className="similar-grid">
                    {complements.map((p) => (
                      <ProductCard key={p.id} product={p} onOpen={onSelect} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

// ═══════════ شریتی ئامرازی سەرەوەی توخم ═══════════
//
// کاتێک شتێک هەڵدەبژێردرێت، شریتەکە لە سەرەوەی خۆیدا دەردەکەوێت —
// نەک لە پانێڵی لاوە. واتە چاوت لەسەر ئەوەیە کە دەیگۆڕیت.
//
// هەمان ئامرازەکان لە مێنیوی کلیکی ڕاستدا دەردەکەون.

import { useEffect, useRef, useState } from 'react';

export interface ToolAction {
  id: string;
  label: string;
  /** نیشانەیەکی کورت — دەق یان SVG */
  icon?: string;
  run: () => void;
  active?: boolean;
  danger?: boolean;
}

export interface ToolGroup {
  /** خانەی ڕەنگ */
  color?: { value: string; onChange: (v: string) => void };
  /** خانەی ژمارە — قەبارەی فۆنت */
  size?: { value: number; onChange: (v: number) => void; min: number; max: number };
  /** لیستی هەڵبژاردن — فۆنت */
  select?: { value: string; onChange: (v: string) => void; options: { v: string; n: string }[] };
  actions: ToolAction[];
}

/** شوێنی شریتەکە بە پیکسڵی شاشە */
export interface ToolAnchor { x: number; y: number }

export default function Toolbar({ at, group, onClose }: {
  at: ToolAnchor | null;
  group: ToolGroup;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  // نابێت لە کەناری شاشەدا بشاردرێتەوە
  useEffect(() => {
    if (!at || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const over = r.right - (window.innerWidth - 12);
    const under = 12 - r.left;
    setShift(over > 0 ? -over : under > 0 ? under : 0);
  }, [at, group]);

  if (!at) return null;

  return (
    <div ref={ref} className="tbar" style={{ left: at.x + shift, top: at.y }}
      onPointerDown={e => e.stopPropagation()}>

      {group.color && (
        <label className="tb-color" title="ڕەنگ">
          <span style={{ background: group.color.value || 'var(--pri)' }} />
          <input type="color" value={group.color.value || '#3B5BDB'}
            onChange={e => group.color!.onChange(e.target.value)} />
        </label>
      )}

      {group.select && (
        <select className="tb-sel" value={group.select.value}
          onChange={e => group.select!.onChange(e.target.value)}>
          {group.select.options.map(o => <option key={o.v} value={o.v}>{o.n}</option>)}
        </select>
      )}

      {group.size && (
        <div className="tb-num" title="قەبارە">
          <button onClick={() => group.size!.onChange(Math.max(group.size!.min, group.size!.value - 2))}>−</button>
          <input type="number" value={group.size.value} min={group.size.min} max={group.size.max}
            onChange={e => group.size!.onChange(+e.target.value || group.size!.value)} />
          <button onClick={() => group.size!.onChange(Math.min(group.size!.max, group.size!.value + 2))}>+</button>
        </div>
      )}

      {group.actions.length > 0 && (group.color || group.size || group.select) && <i className="tb-div" />}

      {group.actions.map(a => (
        <button key={a.id} title={a.label}
          className={`tb-btn${a.active ? ' on' : ''}${a.danger ? ' danger' : ''}`}
          onClick={() => { a.run(); if (a.danger) onClose?.(); }}
          dangerouslySetInnerHTML={a.icon?.startsWith('<') ? { __html: a.icon } : undefined}>
          {a.icon?.startsWith('<') ? undefined : (a.icon ?? a.label)}
        </button>
      ))}
    </div>
  );
}

/** هەمان ئامرازەکان، بەڵام وەک مێنیوی کلیکی ڕاست */
export function ContextMenu({ at, actions, onClose }: {
  at: ToolAnchor | null;
  actions: ToolAction[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!at) return;
    const shut = () => onClose();
    window.addEventListener('pointerdown', shut);
    window.addEventListener('scroll', shut, true);
    return () => {
      window.removeEventListener('pointerdown', shut);
      window.removeEventListener('scroll', shut, true);
    };
  }, [at, onClose]);

  if (!at) return null;
  // مێنیوەکە نابێت لە خوارەوەی شاشەدا بڕوات
  const top = Math.min(at.y, window.innerHeight - actions.length * 32 - 20);
  const left = Math.min(at.x, window.innerWidth - 220);

  return (
    <div className="ctx" style={{ left, top }} onPointerDown={e => e.stopPropagation()}>
      {actions.map(a => (
        <button key={a.id} className={`ctx-item${a.danger ? ' danger' : ''}`}
          onClick={() => { a.run(); onClose(); }}>
          <span className="ic">{a.icon}</span>{a.label}
        </button>
      ))}
    </div>
  );
}

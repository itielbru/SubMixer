import { useCallback } from 'react';
import type { ExternalSub } from '@shared/types';
import type { I18nKey } from '@shared/i18n';
import { useDocStore } from '../state/docStore';
import type { ToastKind } from '../hooks/useToasts';

type ToastFn = (msg: string, kind?: ToastKind) => void;
type TFn = (key: I18nKey) => string;

export function useTrackOps({ toast, t }: { toast: ToastFn; t: TFn }) {
  const setTracks = useDocStore((s) => s.setTracks);
  const extSubs = useDocStore((s) => s.extSubs);
  const activeSubId = useDocStore((s) => s.activeSubId);
  const setActiveSubId = useDocStore((s) => s.setActiveSubId);
  const setExtSubs = useDocStore((s) => s.setExtSubs);
  const setCuesBySubId = useDocStore((s) => s.setCuesBySubId);
  const setEditedSubIds = useDocStore((s) => s.setEditedSubIds);
  const pushUndo = useDocStore((s) => s.pushUndo);

  const toggleKeep = useCallback(
    (id: number) => {
      pushUndo();
      setTracks((tr) =>
        tr.map((track) => {
          if (track.id !== id) return track;
          if (track.locked) {
            toast(t('video_locked_tip'), 'warn');
            return track;
          }
          return { ...track, keep: !track.keep };
        }),
      );
    },
    [pushUndo, setTracks, toast, t],
  );

  const setDefault = useCallback(
    (id: number) => {
      pushUndo();
      setTracks((tr) => {
        const target = tr.find((x) => x.id === id);
        if (!target) return tr;
        return tr.map((t) => ({
          ...t,
          def: t.kind === target.kind ? t.id === id : t.def,
        }));
      });
    },
    [pushUndo, setTracks],
  );

  const setForced = useCallback(
    (id: number) => {
      pushUndo();
      setTracks((tr) => tr.map((t) => (t.id === id ? { ...t, forced: !t.forced } : t)));
    },
    [pushUndo, setTracks],
  );

  const updateSub = useCallback(
    (id: string, patch: Partial<ExternalSub>) => {
      setExtSubs((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    },
    [setExtSubs],
  );

  const removeSub = useCallback(
    (id: string) => {
      setExtSubs((s) => s.filter((x) => x.id !== id));
      setCuesBySubId((m) => {
        if (!(id in m)) return m;
        const n = { ...m };
        delete n[id];
        return n;
      });
      setEditedSubIds((s) => {
        if (!s.has(id)) return s;
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      if (activeSubId === id) {
        const rest = extSubs.filter((x) => x.id !== id);
        setActiveSubId(rest[0]?.id ?? null);
      }
    },
    [activeSubId, extSubs, setExtSubs, setCuesBySubId, setEditedSubIds, setActiveSubId],
  );

  return { toggleKeep, setDefault, setForced, updateSub, removeSub };
}

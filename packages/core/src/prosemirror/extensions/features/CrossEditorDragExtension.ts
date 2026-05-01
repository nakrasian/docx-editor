/**
 * CrossEditorDragExtension — enables dragging ProseMirror content between
 * separate editor instances in the same browser tab.
 *
 * On dragstart the selected slice is serialized to JSON and kept in a
 * module-level variable (same JS runtime). On drop in any other editor
 * instance the slice is deserialized and inserted at the drop position.
 * The native dataTransfer API is used as a secondary transport for
 * compatibility with browsers that restrict custom MIME types.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import { Slice } from 'prosemirror-model';
import { createExtension } from '../create';
import type { ExtensionRuntime } from '../types';

const MIME_TYPE = 'application/x-docx-slice';
const SCHEMA_VERSION = 'docx-editor-v1';
const crossEditorDragKey = new PluginKey('crossEditorDrag');

// Module-level transfer — shared across all instances in the same tab.
let pendingSlice: { json: object; sourceInstanceId: string } | null = null;
let _instanceCounter = 0;

export const CrossEditorDragExtension = createExtension({
  name: 'crossEditorDrag',
  onSchemaReady(_ctx): ExtensionRuntime {
    const instanceId = String(++_instanceCounter);

    const plugin = new Plugin({
      key: crossEditorDragKey,
      props: {
        handleDOMEvents: {
          dragstart(view, event) {
            const { selection } = view.state;
            if (selection.empty) return false;

            const slice = selection.content();
            pendingSlice = { json: slice.toJSON(), sourceInstanceId: instanceId };

            try {
              event.dataTransfer?.setData(
                MIME_TYPE,
                JSON.stringify({ json: slice.toJSON(), schema: SCHEMA_VERSION })
              );
            } catch {
              // Some browsers restrict custom MIME types; silently ignore.
            }

            // Return false — let ProseMirror's own drag handling continue.
            return false;
          },

          dragend() {
            pendingSlice = null;
            return false;
          },

          drop(view, event) {
            // Ignore drops that originated in this same editor instance.
            if (pendingSlice?.sourceInstanceId === instanceId) return false;

            let sliceJSON: object | null = null;

            if (pendingSlice) {
              sliceJSON = pendingSlice.json;
            } else {
              try {
                const raw = event.dataTransfer?.getData(MIME_TYPE);
                if (raw) {
                  const parsed = JSON.parse(raw) as { json: object; schema: string };
                  if (parsed.schema === SCHEMA_VERSION) sliceJSON = parsed.json;
                }
              } catch {
                return false;
              }
            }

            if (!sliceJSON) return false;

            let slice: Slice;
            try {
              slice = Slice.fromJSON(view.state.schema, sliceJSON);
            } catch {
              return false;
            }

            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (!coords) return false;

            const tr = view.state.tr.replace(coords.pos, coords.pos, slice);
            view.dispatch(tr.scrollIntoView());
            event.preventDefault();
            pendingSlice = null;
            return true;
          },
        },
      },
    });

    return { plugins: [plugin] };
  },
});

import type { MenuEntry } from './ui/MenuDropdown';
import { ToolbarProps } from './Toolbar';
import { TranslationKey } from '../i18n';
import { TableGridInline } from './ui/TableGridInline';

export interface MenuRegistry {
  [menuId: string]: {
    label: string;
    items: MenuEntry[];
    order: number;
  };
}

export interface MenuDependencies extends ToolbarProps {}

export function getMenuConfig(
  deps: MenuDependencies,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  customRegistry?: MenuRegistry
): MenuRegistry {
  const {
    onSave,
    onFormat,
    showPrintButton,
    onPrint,
    onPageSetup,
    onInsertImage,
    onInsertTable,
    showTableInsert,
    onInsertPageBreak,
    onInsertTOC,
  } = deps;

  const defaults: MenuRegistry = {
    file: {
      label: t('toolbar.file'),
      items: [
        onSave && {
          icon: 'save',
          label: t('toolbar.save'),
          shortcut: t('toolbar.saveShortcut'),
          onClick: onSave,
        },
        showPrintButton &&
          onPrint && {
            icon: 'print',
            label: t('toolbar.print'),
            shortcut: t('toolbar.printShortcut'),
            onClick: onPrint,
          },
        onPageSetup && {
          icon: 'settings',
          label: t('toolbar.pageSetup'),
          onClick: onPageSetup,
        },
      ].filter(Boolean) as MenuEntry[],
      order: 1,
    },
    format: {
      label: t('toolbar.format'),
      items: onFormat
        ? [
            {
              icon: 'format_textdirection_l_to_r',
              label: t('toolbar.leftToRight'),
              onClick: () => onFormat?.('setLtr'),
            },
            {
              icon: 'format_textdirection_r_to_l',
              label: t('toolbar.rightToLeft'),
              onClick: () => onFormat?.('setRtl'),
            },
            {
              icon: 'format_clear',
              label: t('toolbar.clearFormatting'),
              onClick: () => onFormat?.('clearFormatting'),
            },
          ]
        : [],
      order: 2,
    },
    insert: {
      label: t('toolbar.insert'),
      items: [
        onInsertImage && {
          icon: 'image',
          label: t('toolbar.image'),
          onClick: onInsertImage,
        },
        showTableInsert &&
          onInsertTable && {
            icon: 'grid_on',
            label: t('toolbar.table'),
            submenuContent: (closeMenu: () => void) => (
              <TableGridInline
                onInsert={(rows: number, cols: number) => {
                  onInsertTable?.(rows, cols);
                  closeMenu();
                }}
              />
            ),
          },
        onInsertPageBreak && {
          icon: 'page_break',
          label: t('toolbar.pageBreak'),
          onClick: onInsertPageBreak,
        },
        onInsertTOC && {
          icon: 'toc',
          label: t('toolbar.tableOfContents'),
          onClick: onInsertTOC,
        },
      ].filter(Boolean) as MenuEntry[],
      order: 3,
    },
  };

  if (!customRegistry) return defaults;

  const merged = { ...defaults };

  Object.entries(customRegistry).forEach(([menuId, customMenu]) => {
    if (merged[menuId]) {
      // Smart Merge: combine items, override label/order if provided
      merged[menuId] = {
        ...merged[menuId],
        label: customMenu.label || merged[menuId].label,
        items: [...merged[menuId].items, ...customMenu.items],
        order: customMenu.order ?? merged[menuId].order,
      };
    } else {
      // New Menu: just add it
      merged[menuId] = customMenu;
    }
  });

  return merged;
}

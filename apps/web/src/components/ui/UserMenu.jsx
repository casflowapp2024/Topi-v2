import { Menu, MenuButton, MenuItems, MenuItem, MenuSeparator } from '@headlessui/react';
import { Cog6ToothIcon, EnvelopeIcon, ArrowRightStartOnRectangleIcon, UserIcon } from '@heroicons/react/20/solid';
import { THEME_OPTIONS, segmentClass } from './ThemeSwitch';

const itemClass = 'w-full flex items-center gap-2 px-3 h-9 rounded-xl text-sm text-gray-700 dark:text-gray-200 data-[focus]:bg-gray-100 dark:data-[focus]:bg-gray-700/60 transition-colors';

/**
 * Menú de usuario (círculo con un muñeco, no las iniciales): Configuración, Conexiones, tema y cerrar sesión.
 * El tema son tres opciones del menú para que se recorran con las flechas; headlessui les fija role=menuitem,
 * así que la elegida se anuncia con texto ("elegido") además de verse marcada.
 */
const UserMenu = ({ user, theme, onThemeChange, onOpenSettings, onLogout }) => {
  const fullName = [user?.name, user?.lastName].filter(Boolean).join(' ');
  return (
    <Menu>
      <MenuButton aria-label="Menú de usuario"
        className="w-9 h-9 shrink-0 rounded-full bg-topi-500 text-white flex items-center justify-center hover:bg-topi-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:focus-visible:ring-offset-surface-sunken transition-colors">
        <UserIcon className="w-5 h-5" aria-hidden="true" />
      </MenuButton>
      <MenuItems anchor={{ to: 'bottom end', gap: 8 }} transition
        className="z-50 w-72 max-w-[calc(100vw-2rem)] p-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl font-Inter focus:outline-none transition duration-150 ease-out data-[closed]:opacity-0 data-[closed]:-translate-y-1 motion-reduce:transition-none">
        <div className="px-3 pt-2 pb-3">
          {fullName && <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate capitalize">{fullName}</p>}
          {user?.email && <p className="text-xs text-ink-2 dark:text-gray-400 truncate">{user.email}</p>}
        </div>
        <MenuSeparator className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
        <MenuItem>
          <button type="button" className={itemClass} onClick={() => onOpenSettings('profile')}>
            <Cog6ToothIcon className="w-4 h-4 text-gray-400" aria-hidden="true" /> Configuración
          </button>
        </MenuItem>
        <MenuItem>
          <button type="button" className={itemClass} onClick={() => onOpenSettings('connections')}>
            <EnvelopeIcon className="w-4 h-4 text-gray-400" aria-hidden="true" /> Conexiones
          </button>
        </MenuItem>
        <MenuSeparator className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
        <div className="px-3 pt-1 pb-2">
          <p id="user-menu-theme" className="text-xs font-medium text-ink-2 dark:text-gray-400 mb-1.5">Tema</p>
          <div role="group" aria-labelledby="user-menu-theme" className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <MenuItem key={value}>
                {({ focus }) => (
                  <button type="button" data-theme-option={value} data-selected={theme === value || undefined}
                    onClick={() => theme !== value && onThemeChange(value)}
                    className={`${segmentClass(theme === value)} ${focus ? 'ring-2 ring-topi-500' : ''}`}>
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                    {theme === value && <span className="sr-only"> (elegido)</span>}
                  </button>
                )}
              </MenuItem>
            ))}
          </div>
        </div>
        <MenuSeparator className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
        <MenuItem>
          <button type="button" className={itemClass} onClick={onLogout}>
            <ArrowRightStartOnRectangleIcon className="w-4 h-4 text-gray-400" aria-hidden="true" /> Cerrar sesión
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
};

export default UserMenu;

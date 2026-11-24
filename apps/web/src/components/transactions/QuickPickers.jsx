import { useMemo, useState } from 'react';
import { Emoji } from 'emoji-picker-react';
import { CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { capitalizeWords, isOpenAccount, accountClass, getBaseCurrency } from '../helpers';

/**
 * Selectores que se abren desde el detalle de una transacción para cambiar la categoría o la cuenta
 * con un toque, sin pasar por "Editar". El buscador va arriba y la lista debajo: en el celular el
 * teclado tapa el final de la lista, nunca el buscador ni las primeras opciones.
 */

const Row = ({ selected, disabled, onClick, children }) => (
    <li>
        <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 disabled:opacity-60 ${selected
                ? 'bg-topi-50 dark:bg-topi-500/15 text-topi-700 dark:text-topi-200 font-semibold'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-900 dark:text-gray-100'}`}>
            {children}
            {selected && <CheckIcon className="w-4 h-4 ml-auto shrink-0 text-topi-500" aria-hidden="true" />}
        </button>
    </li>
);

const EmojiBox = ({ emoji }) => (
    <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
        {emoji ? <Emoji unified={emoji.toLowerCase()} emojiStyle="apple" size={16} /> : null}
    </span>
);

// Primero las del mismo tipo que la transacción (gasto o ingreso), luego por nombre
export const sortCategoriesFor = (categories, expense) => [...categories].sort((a, b) =>
    (Boolean(a.income) === !expense ? 0 : 1) - (Boolean(b.income) === !expense ? 0 : 1)
    || String(a.name).localeCompare(String(b.name), 'es'));

export const CategoryPicker = ({ categories, selectedId, expense, busy, onPick }) => {
    const [term, setTerm] = useState('');
    const q = term.trim().toLowerCase();
    const { mine, recommended } = useMemo(() => {
        const match = (c) => !q || String(c.name).toLowerCase().includes(q);
        return {
            mine: sortCategoriesFor((categories || []).filter(c => !c.isDefault && match(c)), expense),
            // las recomendadas que el usuario aún no tiene; se crean al elegirlas
            recommended: (categories || []).filter(c => c.isDefault && !c.userCat && match(c)),
        };
    }, [categories, q, expense]);

    return (
        <div className="flex flex-col gap-3">
            <label className="relative block">
                <span className="sr-only">Buscar categoría</span>
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input type="search" value={term} onChange={e => setTerm(e.target.value)} placeholder="Buscar categoría"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-gray-50 border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-topi-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400" />
            </label>
            {mine.length === 0 && recommended.length === 0 && (
                <p className="px-1 text-sm text-ink-2 dark:text-gray-400">Ninguna categoría se llama así. Puedes crearla desde "Editar".</p>
            )}
            {mine.length > 0 && (
                <ul aria-label="Tus categorías" className="flex flex-col gap-0.5">
                    {mine.map(c => (
                        <Row key={c.id} selected={String(c.id) === String(selectedId)} disabled={busy} onClick={() => onPick(c)}>
                            <EmojiBox emoji={c.emoji} />
                            <span className="truncate">{capitalizeWords(c.name)}</span>
                        </Row>
                    ))}
                </ul>
            )}
            {recommended.length > 0 && (
                <section aria-label="Recomendadas">
                    <h3 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-2 dark:text-gray-400">Recomendadas</h3>
                    <ul className="flex flex-col gap-0.5">
                        {recommended.map(c => (
                            <Row key={c.id} disabled={busy} onClick={() => onPick(c)}>
                                <EmojiBox emoji={c.emoji} />
                                <span className="truncate">{capitalizeWords(c.name)}</span>
                            </Row>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
};

const CLASS_LABEL = { deposit: 'Efectivo', investment: 'Inversión', credit: 'Tarjeta' };

export const AccountPicker = ({ accounts, selectedId, busy, onPick }) => {
    // las cerradas no reciben movimientos (salvo la que ya tiene la transacción)
    const list = (accounts || []).filter(a => isOpenAccount(a) || String(a.id) === String(selectedId));
    const base = getBaseCurrency();
    return (
        <ul aria-label="Cuentas" className="flex flex-col gap-0.5">
            {list.map(a => (
                <Row key={a.id} selected={String(a.id) === String(selectedId)} disabled={busy} onClick={() => onPick(a)}>
                    <span className="min-w-0 flex flex-col">
                        <span className="truncate">{a.name}{a.last_four_digits ? ` ••${a.last_four_digits}` : ''}</span>
                        <span className="text-xs font-normal text-ink-2 dark:text-gray-400">
                            {CLASS_LABEL[accountClass(a)] || 'Cuenta'}{a.currency && a.currency !== base ? ` · ${a.currency}` : ''}
                        </span>
                    </span>
                </Row>
            ))}
        </ul>
    );
};

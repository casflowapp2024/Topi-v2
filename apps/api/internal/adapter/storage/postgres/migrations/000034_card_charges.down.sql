DROP FUNCTION card_charges(VARCHAR, DATE);

-- La categoría se conserva si el usuario la usó o le puso presupuesto
DELETE FROM categories c
WHERE c.name = 'Cargos de Tarjeta' AND c.budget = 0
  AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.category_id = c.id);

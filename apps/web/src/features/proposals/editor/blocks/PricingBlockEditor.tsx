import type { LineItem } from '@studioflow/contracts'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  formatMoney,
  itemsTotalCents,
  lineTotalCents,
  moneyInputValue,
  parseMoneyInput,
  parseQuantityInput,
} from '../money'
import { newBlockId } from '../documentReducer'
import styles from '../Editor.module.css'
import type { BlockEditorProps } from './types'
import { useNumberField } from './useNumberField'

const quantityFormat = (value: number) => String(value)

/**
 * The block that carries real weight: fractional quantities, integer money, and
 * totals formatted in the client's currency with `Intl`. Week 7's invoices are
 * built on exactly this arithmetic.
 */
export function PricingBlockEditor({
  block,
  onChange,
  currency,
}: BlockEditorProps<'pricing'> & { currency: string }) {
  function replaceItem(id: string, next: LineItem) {
    onChange({
      ...block,
      items: block.items.map((item) => (item.id === id ? next : item)),
    })
  }

  return (
    <div className={styles.pricing}>
      <table className={styles.pricingTable}>
        <thead>
          <tr>
            <th scope="col">Description</th>
            <th scope="col">Qty</th>
            <th scope="col">Unit price</th>
            <th scope="col">Total</th>
            <th scope="col">
              <span className="sf-visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {block.items.map((item, index) => (
            <PricingRow
              key={item.id}
              item={item}
              index={index}
              currency={currency}
              onChange={(next) => replaceItem(item.id, next)}
              onRemove={() =>
                onChange({
                  ...block,
                  items: block.items.filter((other) => other.id !== item.id),
                })
              }
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              Total
            </th>
            <td colSpan={2}>
              <strong>
                {formatMoney(itemsTotalCents(block.items), currency)}
              </strong>
            </td>
          </tr>
        </tfoot>
      </table>

      <Button
        type="button"
        variant="soft"
        size="sm"
        onClick={() =>
          onChange({
            ...block,
            items: [
              ...block.items,
              {
                id: newBlockId('li'),
                description: '',
                quantity: 1,
                unitPriceCents: 0,
              },
            ],
          })
        }
      >
        Add line
      </Button>
    </div>
  )
}

function PricingRow({
  item,
  index,
  currency,
  onChange,
  onRemove,
}: {
  item: LineItem
  index: number
  currency: string
  onChange: (item: LineItem) => void
  onRemove: () => void
}) {
  const quantity = useNumberField(
    item.quantity,
    quantityFormat,
    parseQuantityInput,
    (value) => onChange({ ...item, quantity: value }),
  )
  const price = useNumberField(
    item.unitPriceCents,
    moneyInputValue,
    parseMoneyInput,
    (value) => onChange({ ...item, unitPriceCents: value }),
  )

  // Each row's fields need names of their own, or every row's "Qty" would be
  // indistinguishable to anyone navigating by label.
  const position = index + 1

  return (
    <tr>
      <td>
        <Input
          aria-label={`Description, line ${position}`}
          value={item.description}
          placeholder="What this covers"
          onChange={(event) =>
            onChange({ ...item, description: event.target.value })
          }
        />
      </td>
      <td>
        <Input
          aria-label={`Quantity, line ${position}`}
          inputMode="decimal"
          className={styles.numeric}
          value={quantity.value}
          onChange={(event) => quantity.onChange(event.target.value)}
        />
      </td>
      <td>
        <Input
          aria-label={`Unit price, line ${position}`}
          inputMode="decimal"
          className={styles.numeric}
          value={price.value}
          onChange={(event) => price.onChange(event.target.value)}
        />
      </td>
      <td>{formatMoney(lineTotalCents(item), currency)}</td>
      <td>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Remove line ${position}`}
          onClick={onRemove}
        >
          Remove
        </Button>
      </td>
    </tr>
  )
}

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check } from 'lucide-react';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  received: number;
}

interface GoodsReceiptFormProps {
  lineItems: LineItem[];
  onConfirm?: (receivedQuantities: number[]) => void;
}

export function GoodsReceiptForm({ lineItems, onConfirm }: GoodsReceiptFormProps) {
  const [quantities, setQuantities] = useState<number[]>(lineItems.map((li) => li.received));

  const updateQuantity = (index: number, value: number) => {
    setQuantities((prev) => {
      const next = [...prev];
      next[index] = Math.max(0, Math.min(value, lineItems[index].quantity));
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Goods Receipt</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left font-medium text-muted-foreground">Description</th>
              <th className="py-2 text-center font-medium text-muted-foreground w-20">Ordered</th>
              <th className="py-2 text-center font-medium text-muted-foreground w-28">Received</th>
              <th className="py-2 text-center font-medium text-muted-foreground w-20">Status</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, i) => {
              const fullyReceived = quantities[i] >= li.quantity;
              return (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2">{li.description}</td>
                  <td className="py-2 text-center">{li.quantity}</td>
                  <td className="py-2 text-center">
                    <Input
                      type="number"
                      min={0}
                      max={li.quantity}
                      className="w-20 mx-auto text-center"
                      value={quantities[i]}
                      onChange={(e) => updateQuantity(i, Number(e.target.value))}
                    />
                  </td>
                  <td className="py-2 text-center">
                    {fullyReceived ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <Check className="size-3" /> Complete
                      </span>
                    ) : quantities[i] > 0 ? (
                      <span className="text-xs text-amber-700">Partial</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => onConfirm?.(quantities)}>
            <Check className="size-3.5" />
            Confirm Receipt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useSupplier } from '@/lib/db/hooks/use-suppliers';

const PORTAL_SUPPLIER_ID = 'SUP-001';

export function PortalProfile() {
  const { data: supplier } = useSupplier(PORTAL_SUPPLIER_ID);

  if (!supplier) {
    return <p className="text-sm text-muted-foreground">Supplier not found.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Company Profile</h1>

      <Card className="py-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Company Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Company Name</Label>
              <Input value={supplier.name} readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">D&B Number</Label>
              <Input value={supplier.duns} readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Address</Label>
              <Input value={supplier.address} readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Country</Label>
              <Input value={supplier.country} readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tier</Label>
              <Input value={`Tier ${supplier.tier}`} readOnly className="bg-gray-50" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Primary Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Contact Name</Label>
              <Input value={supplier.primaryContact} readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={supplier.primaryContactEmail} readOnly className="bg-gray-50" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Bank Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Bank Name</Label>
              <Input value="Bank of Ireland" readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">IBAN</Label>
              <Input value="IE29 AIBK **** **** **42" readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">BIC/SWIFT</Label>
              <Input value="AIBK IE2D" readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Account Holder</Label>
              <Input value={supplier.name} readOnly className="bg-gray-50" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

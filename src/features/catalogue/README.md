# Catalogue checkout

Catalogue items are read through the standard catalogue connector and open at
`/catalogue/items/:id`. The item-detail page hands a fulfilment draft to the
shared checkout entry point; governed persistence then creates the request and
purchase requisition and conditionally creates an internal PO. No upstream
purchasing system is written by this feature.

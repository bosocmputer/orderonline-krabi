export function openQuotationPdf({ cart, customerCode, customerName, warehouseName, createdBy, docDate }) {
    const dateStr = docDate || new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    let grandTotal = 0;
    const rows = cart.map((item, idx) => {
        const qty = parseInt(item.qty) || 0;
        const price = parseFloat(item.price) || 0;
        const total = qty * price;
        grandTotal += total;
        const whShelf = [item.wh_code, item.shelf_code].filter(Boolean).join(' / ');
        return `<tr>
            <td style="text-align:center">${idx + 1}</td>
            <td>${item.item_code || ''}</td>
            <td>${item.item_name || ''}</td>
            <td>${whShelf}</td>
            <td style="text-align:center">${qty}</td>
            <td style="text-align:center">${item.unit_code || ''}</td>
            <td style="text-align:right">${price.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="text-align:right">${total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>`;
    }).join('');

    const totalRow = `<tr>
        <td colspan="7" style="text-align:right;font-weight:bold;border-top:2px solid #000">รวมทั้งสิ้น</td>
        <td style="text-align:right;font-weight:bold;border-top:2px solid #000">${grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>`;

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>ใบเสนอราคา</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; font-size: 11pt; color: #000; padding: 0.5cm 0.8cm; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 0.3rem; margin-bottom: 0.5rem; }
  .header h2 { font-size: 14pt; font-weight: bold; margin-bottom: 2px; }
  .header p { font-size: 10pt; color: #555; }
  .info { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 10pt; }
  .info-left td { padding: 1px 10px 1px 0; }
  .info-right { text-align: right; }
  table.items { width: 100%; border-collapse: collapse; font-size: 10pt; }
  table.items th { background: #f3f4f6; border: 1px solid #ccc; padding: 4px 6px; font-weight: bold; }
  table.items td { border: 1px solid #ccc; padding: 3px 6px; }
  .remark { font-size: 9pt; color: #666; font-style: italic; margin-top: 0.5rem; }
  @media print {
    body { padding: 0; }
    @page { size: A4; margin: 1cm; }
  }
</style>
</head>
<body>
<div class="header">
  <h2>ใบเสนอราคา / Quotation</h2>
  <p>วันที่: ${dateStr}</p>
</div>
<div class="info">
  <table class="info-left"><tbody>
    <tr><td>รหัสลูกค้า:</td><td><b>${customerCode || '-'}</b></td></tr>
    <tr><td>ลูกค้า:</td><td><b>${customerName || '-'}</b></td></tr>
  </tbody></table>
  <div class="info-right">
    <div>คลังสินค้า: ${warehouseName || '-'}</div>
    <div>ผู้เสนอราคา: ${createdBy || '-'}</div>
  </div>
</div>
<table class="items">
  <thead>
    <tr>
      <th style="width:40px">ลำดับ</th>
      <th>รหัสสินค้า</th>
      <th>ชื่อสินค้า</th>
      <th>คลัง/ที่เก็บ</th>
      <th style="width:60px">จำนวน</th>
      <th style="width:60px">หน่วย</th>
      <th style="width:100px">ราคา/หน่วย</th>
      <th style="width:100px">รวม</th>
    </tr>
  </thead>
  <tbody>${rows}${totalRow}</tbody>
</table>

<script>
  document.fonts.ready.then(() => { window.print(); });
<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
}

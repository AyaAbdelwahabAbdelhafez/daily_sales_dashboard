/**
 * Apps Script Web App — exposes a Google Form-linked Sheet as JSON
 * so the dashboard can read it without making the Sheet public.
 *
 * SETUP:
 * 1) Open the Google Sheet connected to your Form's responses.
 * 2) Extensions → Apps Script. Delete any starter code and paste this in.
 * 3) Click "Deploy" → "New deployment" → type: "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone with the link
 * 4) Copy the Web App URL it gives you (ends in /exec).
 * 5) Paste that URL into the dashboard's "ربط Apps Script Web App" settings panel.
 *
 * Expected column order (row 0 = header row, skipped automatically):
 * 0 الطابع الزمني   1 البريد الإلكتروني   2 اسم الموظف   3 النظام
 * 4 الفرع           5 العهدة              6 مبيعات الكاش  7 مبيعات المحفظة
 * 8 مبيعات التحويلات البنكية   9 مبيعات وسائل أخرى   10 ملاحظات إضافية
 */

function doGet(e) {
  try {
    var sheetName = e && e.parameter && e.parameter.sheet;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];

    if (!sheet) {
      return jsonResponse({ error: "sheet-not-found" });
    }

    var values = sheet.getDataRange().getValues();
    // Drop the header row.
    var rows = values.slice(1).map(function (row) {
      return row.map(function (cell) {
        if (Object.prototype.toString.call(cell) === "[object Date]") {
          return cell.toISOString();
        }
        return cell;
      });
    });

    return jsonResponse(rows);
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

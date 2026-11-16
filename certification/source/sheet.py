import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from final import *  # стили, шрифты, Box, bar, note, labeled
from sheet_texts import S

def crit_table(rows, L, prefix):
    """rows: [(text, max)] -> таблица: № | критерий | макс | поле балла"""
    data = [[Paragraph(L["col_n"], S_LBL), Paragraph(L["col_k"], S_LBL), Paragraph(L["col_m"], S_LBL), Paragraph(L["col_s"], S_LBL)]]
    for i, (txt, mx) in enumerate(rows, 1):
        data.append([Paragraph(str(i), S_Q), Paragraph(txt, S_TXT), Paragraph(str(mx), S_Q), Box(f"{prefix}{i}", 7 * mm, 16 * mm)])
    t = Table(data, colWidths=[9 * mm, CW - 9 * mm - 14 * mm - 20 * mm, 14 * mm, 20 * mm], repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), BAR), ("LINEBELOW", (0, 0), (-1, -1), 0.5, BOX), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                           ("VALIGN", (1, 1), (1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 2 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
                           ("LEFTPADDING", (0, 0), (-1, -1), 1.8 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 1.8 * mm), ("ALIGN", (2, 0), (2, -1), "CENTER")]))
    return t

def section(L, title, rows, prefix):
    return [CondPageBreak(60 * mm), bar(title), Spacer(1, 3 * mm), crit_table(rows, L, prefix), Spacer(1, 3 * mm),
            KeepTogether([Paragraph(L["comment"], S_LBL), Spacer(1, 1.5 * mm), Box(f"{prefix}_comment", 14 * mm)]), Spacer(1, 6 * mm)]

def build_sheet(lang, out, total=None):
    L = S[lang]; path = os.path.join(out, L["file"]); pages = {"n": 0}
    def deco(c, d):
        c.saveState(); c.setFont("DVB", 7.5); c.setFillColor(MUT); c.drawString(ML, H - 12 * mm, L["brand"])
        c.setStrokeColor(INK); c.setLineWidth(0.8); c.line(ML, H - 14 * mm, W - MR, H - 14 * mm)
        c.setFont("DV", 7.5); c.drawRightString(W - MR, 10 * mm, L["footer"].format(p=d.page, n=total or "?")); pages["n"] = d.page; c.restoreState()
    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=ML, rightMargin=MR, topMargin=MT, bottomMargin=MB, title=L["doc_title"], author="Clopos Retention")
    doc.addPageTemplates([PageTemplate("p", [Frame(ML, MB, CW, H - MT - MB, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=deco)])
    s = [Paragraph(L["title"], S_TITLE), Spacer(1, 1.5 * mm), Paragraph(L["subtitle"], S_SUB), Spacer(1, 2.5 * mm)]
    ln = Table([[""]], colWidths=[CW], rowHeights=[0.1]); ln.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, -1), 1, ACC)])); s += [ln, Spacer(1, 5 * mm)]
    s += [labeled([(L["f_name"], "name", 110 * mm), (L["f_date"], "check_date", CW - 115 * mm)]), Spacer(1, 4 * mm),
          labeled([(L["f_mentor"], "mentor", 80 * mm), (L["f_lead"], "assessor", CW - 85 * mm)]), Spacer(1, 5 * mm),
          note(L["instr"], INFO, ACC), Spacer(1, 6 * mm)]
    s += section(L, L["A"], [(t, 3) for t in L["A_items"]], "a")
    s += section(L, L["B"], L["B_items"], "b")
    s += section(L, L["C"], L["C_items"], "c")
    s += section(L, L["D"], L["D_items"], "d")
    rows = [[Paragraph(n, S_TXT), Paragraph(str(m), S_Q), Box(f"sum_{i}", 7 * mm, 16 * mm)] for i, (n, m) in enumerate(L["sum_rows"])]
    rows.append([Paragraph(f"<b>{L['total']}</b>", S_TXT), Paragraph("100", S_Q), Box("sum_total", 7 * mm, 16 * mm)])
    t = Table(rows, colWidths=[CW - 34 * mm, 14 * mm, 20 * mm])
    t.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.5, BOX), ("BACKGROUND", (0, -1), (-1, -1), BAR), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                           ("TOPPADDING", (0, 0), (-1, -1), 1.6 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.6 * mm), ("LEFTPADDING", (0, 0), (-1, -1), 1.8 * mm),
                           ("ALIGN", (1, 0), (1, -1), "CENTER")]))
    s += [KeepTogether([bar(L["sum_title"]), Spacer(1, 3 * mm), t, Spacer(1, 4 * mm),
                        Paragraph(L["result"], S_LBL), Spacer(1, 1.5 * mm), Box("result", 8 * mm)]), Spacer(1, 4 * mm),
          KeepTogether([Paragraph(L["strengths"], S_LBL), Spacer(1, 1.5 * mm), Box("strengths", 18 * mm), Spacer(1, 4 * mm),
                        Paragraph(L["improve"], S_LBL), Spacer(1, 1.5 * mm), Box("improve", 18 * mm), Spacer(1, 5 * mm),
                        labeled([(L["sign1"], "sign_mentor", 70 * mm), (L["sign2"], "sign_lead", 70 * mm), (L["date"], "sign_date", CW - 150 * mm)])])]
    doc.build(s); return path, pages["n"]

if __name__ == "__main__":
    out = sys.argv[1]
    from pypdf import PdfReader, PdfWriter
    for lang in ("ru", "uz"):
        p, n = build_sheet(lang, out); p, n2 = build_sheet(lang, out, total=n)
        r = PdfReader(p); w = PdfWriter(clone_from=r); w.set_need_appearances_writer(True)
        with open(p, "wb") as fh: w.write(fh)
        print(os.path.basename(p), n2, "pages,", len(r.get_fields()), "fields")

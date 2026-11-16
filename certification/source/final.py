import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from texts import T
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Flowable, KeepTogether, Table, TableStyle, CondPageBreak

F = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("DV", F + "DejaVuSans.ttf")); pdfmetrics.registerFont(TTFont("DVB", F + "DejaVuSans-Bold.ttf"))
addMapping("DV", 0, 0, "DV"); addMapping("DV", 1, 0, "DVB"); addMapping("DV", 0, 1, "DV"); addMapping("DV", 1, 1, "DVB")
NAVY = colors.HexColor("#1F3A5F"); INK = colors.HexColor("#1B2733"); MUT = colors.HexColor("#5B6B7C")
BAR = colors.HexColor("#E4ECF6"); BOX = colors.HexColor("#B9C8D9"); ACC = colors.HexColor("#1E6FE8")
INFO = colors.HexColor("#E8EFF8"); WARN_BG = colors.HexColor("#FFF4E6"); WARN = colors.HexColor("#D9822B")
W, H = A4; ML = MR = 20 * mm; MT = 20 * mm; MB = 18 * mm; CW = W - ML - MR

def st(**k):
    d = dict(fontName="DV", fontSize=9.5, leading=13, textColor=INK); d.update(k); return ParagraphStyle("s", **d)
S_LBL = st(fontName="DVB", fontSize=8.5, leading=11); S_Q = st(fontName="DVB", fontSize=9.5, leading=13)
S_TXT = st(fontSize=9, leading=12.5); S_TITLE = st(fontName="DVB", fontSize=17, leading=21, textColor=NAVY)
S_SUB = st(fontSize=9, leading=12, textColor=MUT); S_BAR = st(fontName="DVB", fontSize=10, leading=13, textColor=NAVY)

class Box(Flowable):
    """Поле ответа: рамка + поле ввода PDF."""
    def __init__(self, name, h, w=CW):
        super().__init__(); self.name = name; self.h = h; self.w = w
    def wrap(self, aw, ah): return self.w, self.h
    def draw(self):
        c = self.canv; c.setStrokeColor(BOX); c.setLineWidth(0.7); c.setFillColor(colors.white); c.rect(0, 0, self.w, self.h, stroke=1, fill=1)
        x, y = c.absolutePosition(1 * mm, 0.8 * mm)
        c.acroForm.textfield(name=self.name, tooltip=self.name, x=x, y=y, width=self.w - 2 * mm, height=self.h - 1.6 * mm,
                             fontName="Helvetica", fontSize=10, borderWidth=0, fillColor=None, borderColor=None, textColor=INK,
                             forceBorder=False, fieldFlags="multiline" if self.h > 10 * mm else "")

def bar(text):
    t = Table([[Paragraph(text, S_BAR)]], colWidths=[CW])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), BAR), ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm), ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm), ("ROUNDEDCORNERS", [1.5 * mm] * 4)]))
    return t

def note(text, bg, edge):
    t = Table([["", Paragraph(text, S_TXT)]], colWidths=[1.2 * mm, CW - 1.2 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), edge), ("BACKGROUND", (1, 0), (1, 0), bg), ("LEFTPADDING", (1, 0), (1, 0), 3.5 * mm),
                           ("RIGHTPADDING", (1, 0), (1, 0), 3.5 * mm), ("TOPPADDING", (0, 0), (-1, -1), 2.6 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.6 * mm),
                           ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 0)]))
    return t

def labeled(items, gap=5 * mm, h=8 * mm):
    """Строка подписанных полей: items = [(label, name, width)]"""
    row1 = []; row2 = []; widths = []
    for i, (lbl, name, w) in enumerate(items):
        row1.append(Paragraph(lbl, S_LBL)); row2.append(Box(name, h, w)); widths.append(w + (gap if i < len(items) - 1 else 0))
    t = Table([row1, row2], colWidths=widths)
    t.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
                           ("BOTTOMPADDING", (0, 0), (-1, 0), 1.5 * mm), ("BOTTOMPADDING", (0, 1), (-1, 1), 0), ("VALIGN", (0, 0), (-1, -1), "BOTTOM")]))
    t.hAlign = "LEFT"
    return t

def build(lang, out, total=None):
    L = T[lang]; path = os.path.join(out, L["file"]); pages = {"n": 0}
    def deco(c, d):
        c.saveState(); c.setFont("DVB", 7.5); c.setFillColor(MUT); c.drawString(ML, H - 12 * mm, L["brand"])
        c.setStrokeColor(INK); c.setLineWidth(0.8); c.line(ML, H - 14 * mm, W - MR, H - 14 * mm)
        c.setFont("DV", 7.5); c.drawRightString(W - MR, 10 * mm, L["footer"].format(p=d.page, n=total or "?")); pages["n"] = d.page; c.restoreState()
    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=ML, rightMargin=MR, topMargin=MT, bottomMargin=MB, title=L["doc_title"], author="Clopos Retention")
    doc.addPageTemplates([PageTemplate("p", [Frame(ML, MB, CW, H - MT - MB, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=deco)])
    s = [Paragraph(L["title"], S_TITLE), Spacer(1, 1.5 * mm), Paragraph(L["subtitle"], S_SUB), Spacer(1, 2.5 * mm)]
    ln = Table([[""]], colWidths=[CW], rowHeights=[0.1]); ln.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, -1), 1, ACC)])); s += [ln, Spacer(1, 5 * mm)]
    s += [labeled([(L["f_name"], "name", 80 * mm), (L["f_start"], "start_date", 42 * mm), (L["f_date"], "test_date", CW - 80 * mm - 42 * mm - 10 * mm)]), Spacer(1, 4 * mm),
          labeled([(L["f_mentor"], "mentor", 80 * mm), (L["f_lead"], "assessor", CW - 80 * mm - 5 * mm)]), Spacer(1, 5 * mm),
          note(L["instr"], INFO, ACC), Spacer(1, 5 * mm), bar(L["A"]), Spacer(1, 4 * mm)]
    first = True
    for i, q in enumerate(L["qs"], 1):
        blk = [Paragraph(f"{i}. {q}", S_Q), Spacer(1, 2 * mm), Box(f"q{i}", 24 * mm), Spacer(1, 4.5 * mm)]
        s.append(KeepTogether(blk))
    s += [CondPageBreak(120 * mm), Spacer(1, 2 * mm), bar(L["B"]), Spacer(1, 4 * mm), note(L["B_case"], WARN_BG, WARN), Spacer(1, 4 * mm)]
    for j, f in enumerate(L["B_fields"]):
        if len(f) == 4:
            s += [labeled([(f[0], "b_status", 55 * mm), (f[2], "b_priority", CW - 60 * mm)]), Spacer(1, 4 * mm)]
        else:
            s.append(KeepTogether([Paragraph(f[0], S_LBL), Spacer(1, 1.5 * mm), Box(f"b{j}", f[1] * 6.5 * mm), Spacer(1, 4 * mm)]))
    s += [CondPageBreak(110 * mm), Spacer(1, 2 * mm), bar(L["C"]), Spacer(1, 4 * mm), note(L["C_case"], WARN_BG, WARN), Spacer(1, 4 * mm), Box("c1", 60 * mm), Spacer(1, 6 * mm)]
    s += [KeepTogether([bar(L["D"]), Spacer(1, 4 * mm), note(L["D_case"], INFO, ACC), Spacer(1, 4 * mm), Paragraph(L["D_field"], S_LBL), Spacer(1, 1.5 * mm), Box("d1", 38 * mm)]), Spacer(1, 6 * mm)]
    s += [KeepTogether([bar(L["conf"]), Spacer(1, 3 * mm), Paragraph(L["conf_text"], S_TXT), Spacer(1, 3 * mm),
                        labeled([(L["sign"], "sign", 100 * mm), (L["sign_date"], "sign_date", CW - 105 * mm)]), Spacer(1, 4 * mm),
                        labeled([(L["score"], "score", 60 * mm)])])]
    doc.build(s); return path, pages["n"]

if __name__ == "__main__":
    out = sys.argv[1]
    from pypdf import PdfReader, PdfWriter
    for lang in ("ru", "uz"):
        p, n = build(lang, out); p, n2 = build(lang, out, total=n)
        r = PdfReader(p); w = PdfWriter(clone_from=r); w.set_need_appearances_writer(True)
        with open(p, "wb") as fh: w.write(fh)
        print(os.path.basename(p), n2, "pages,", len(r.get_fields()), "fields")

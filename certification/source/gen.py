import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data import SECTIONS, CASES
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Flowable,
                                KeepTogether, Table, TableStyle, PageBreak, CondPageBreak)

F = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("DV", F + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DVB", F + "DejaVuSans-Bold.ttf"))
from reportlab.lib.fonts import addMapping
addMapping("DV", 0, 0, "DV"); addMapping("DV", 1, 0, "DVB"); addMapping("DV", 0, 1, "DV"); addMapping("DV", 1, 1, "DVB")

ACC = colors.HexColor("#1E6FE8"); INK = colors.HexColor("#0E2246"); MUT = colors.HexColor("#566B8C")
LINE = colors.HexColor("#D2E1F6"); SOFT = colors.HexColor("#EEF4FD"); RULE = colors.HexColor("#E1EBF8")
OK = colors.HexColor("#17794A"); WARN = colors.HexColor("#9A5800"); WARNS = colors.HexColor("#FDF3E1")

W, H = A4; ML = MR = 18 * mm; MT = 22 * mm; MB = 18 * mm
CW = W - ML - MR

def st(**k):
    d=dict(fontName="DV", fontSize=10, leading=14, textColor=INK); d.update(k); return ParagraphStyle("x", **d)
S_BODY = st(); S_Q = st(fontSize=10.5, leading=14.5); S_SMALL = st(fontSize=8.5, leading=11.5, textColor=MUT)
S_H1 = st(fontName="DVB", fontSize=26, leading=31); S_H2 = st(fontName="DVB", fontSize=15, leading=19, textColor=INK)
S_LEAD = st(fontSize=12, leading=17, textColor=MUT); S_EYE = st(fontName="DVB", fontSize=8, leading=10, textColor=ACC)
S_KEY = st(fontSize=9.5, leading=13.5); S_CELL = st(fontSize=9.5, leading=13); S_CELLB = st(fontName="DVB", fontSize=9.5, leading=13)

def logo(c, x, y, r):
    """Логотип Clopos: синий круг, три белых квадрата и один контурный."""
    c.saveState(); c.setFillColor(ACC); c.circle(x, y, r, stroke=0, fill=1)
    s = r * 0.516; g = r * 0.06; rad = r * 0.11
    pos = [(-s - g / 2, g / 2), (g / 2, g / 2), (-s - g / 2, -s - g / 2)]
    c.setFillColor(colors.white)
    for dx, dy in pos: c.roundRect(x + dx, y + dy, s, s, rad, stroke=0, fill=1)
    c.setStrokeColor(colors.white); c.setLineWidth(r * 0.07)
    lw = r * 0.07; c.roundRect(x + g / 2 + lw / 2, y - s - g / 2 + lw / 2, s - lw, s - lw, rad, stroke=1, fill=0)
    c.restoreState()

class Doc(BaseDocTemplate):
    def __init__(self, fn, title, running, **kw):
        super().__init__(fn, pagesize=A4, leftMargin=ML, rightMargin=MR, topMargin=MT, bottomMargin=MB,
                         title=title, author="Clopos Retention Academy", **kw)
        self.running = running
        fr = Frame(ML, MB, CW, H - MT - MB, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([PageTemplate("p", [fr], onPage=self.deco)])
    def deco(self, c, d):
        c.saveState()
        if d.page > 1:
            logo(c, ML + 3.2 * mm, H - 12 * mm, 3.2 * mm)
            c.setFont("DVB", 8.5); c.setFillColor(INK); c.drawString(ML + 8.5 * mm, H - 13.1 * mm, "Clopos Retention Academy")
            c.setFont("DV", 8.5); c.setFillColor(MUT); c.drawRightString(W - MR, H - 13.1 * mm, self.running)
            c.setStrokeColor(LINE); c.setLineWidth(0.6); c.line(ML, H - 16 * mm, W - MR, H - 16 * mm)
        c.setFont("DV", 8); c.setFillColor(MUT)
        c.drawRightString(W - MR, 10 * mm, f"стр. {d.page}")
        c.drawString(ML, 10 * mm, "Clopos · отдел Retention · сертификация стажёра")
        c.restoreState()

class Field(Flowable):
    """Поле для ответа: рамка с линейками (для печати) и поле ввода PDF (для заполнения на компьютере)."""
    def __init__(self, name, lines, width=CW, line_h=7.2 * mm, tooltip=""):
        super().__init__(); self.name = name; self.lines = lines; self.w = width; self.lh = line_h; self.tip = tooltip
        self.h = lines * line_h + 4 * mm
    def wrap(self, aw, ah): return self.w, self.h
    def draw(self):
        c = self.canv
        c.setStrokeColor(LINE); c.setLineWidth(0.8); c.setFillColor(colors.white)
        c.roundRect(0, 0, self.w, self.h, 2.2 * mm, stroke=1, fill=1)
        c.setStrokeColor(RULE); c.setLineWidth(0.5)
        for i in range(1, self.lines + 1):
            y = self.h - 2 * mm - i * self.lh + 1.2 * mm
            if y > 2 * mm: c.line(4 * mm, y, self.w - 4 * mm, y)
        x0, y0 = c.absolutePosition(1.5 * mm, 1.2 * mm)
        c.acroForm.textfield(name=self.name, tooltip=self.tip or self.name, x=x0, y=y0, width=self.w - 3 * mm,
                             height=self.h - 2.4 * mm, fontName="Helvetica", fontSize=10, borderWidth=0,
                             fillColor=None, borderColor=None, textColor=INK, forceBorder=False,
                             fieldFlags="multiline")

class SmallField(Flowable):
    def __init__(self, name, width, height=8 * mm):
        super().__init__(); self.name = name; self.w = width; self.h = height
    def wrap(self, aw, ah): return self.w, self.h
    def draw(self):
        c = self.canv; c.setStrokeColor(LINE); c.setLineWidth(0.8); c.setFillColor(colors.white)
        c.roundRect(0, 0, self.w, self.h, 1.6 * mm, stroke=1, fill=1)
        x0, y0 = c.absolutePosition(1.2 * mm, 0.8 * mm)
        c.acroForm.textfield(name=self.name, tooltip=self.name, x=x0, y=y0, width=self.w - 2.4 * mm, height=self.h - 1.6 * mm,
                             fontName="Helvetica", fontSize=10, borderWidth=0, fillColor=None, borderColor=None,
                             textColor=INK, forceBorder=False)

class Badge(Flowable):
    def __init__(self, text, w=9 * mm, h=7 * mm, fill=ACC, fg=colors.white):
        super().__init__(); self.t = text; self.w = w; self.h = h; self.fill = fill; self.fg = fg
    def wrap(self, aw, ah): return self.w, self.h
    def draw(self):
        c = self.canv; c.setFillColor(self.fill); c.roundRect(0, 0, self.w, self.h, 1.6 * mm, stroke=0, fill=1)
        c.setFillColor(self.fg); c.setFont("DVB", 9.5); c.drawCentredString(self.w / 2, self.h / 2 - 3.3, self.t)

def qhead(num, text, pts):
    t = Table([[Badge(str(num)), Paragraph(text, S_Q), Paragraph(f"<font color='#566B8C'>{pts} балл{'а' if pts in (2,3,4) else 'ов'}</font>", st(fontSize=8.5, leading=11, alignment=2))]],
              colWidths=[11 * mm, CW - 11 * mm - 20 * mm, 20 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                           ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0), ("LEFTPADDING", (1, 0), (1, 0), 2 * mm)]))
    return t

def section_title(n, title, sub):
    return [CondPageBreak(60 * mm), Spacer(1, 4 * mm), Paragraph(f"РАЗДЕЛ {n}", S_EYE), Spacer(1, 1.2 * mm),
            Paragraph(title, S_H2), Spacer(1, 1 * mm), Paragraph(sub, S_SMALL), Spacer(1, 4 * mm)]

def info_box(rows, bg=SOFT):
    t = Table([[Paragraph(r, S_CELL)] for r in rows], colWidths=[CW])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm), ("TOPPADDING", (0, 0), (0, 0), 4 * mm),
                           ("BOTTOMPADDING", (0, -1), (-1, -1), 4 * mm), ("TOPPADDING", (0, 1), (-1, -1), 1.2 * mm),
                           ("ROUNDEDCORNERS", [3 * mm] * 4)]))
    return t

SHORT_PTS, CASE_PTS = 2, 5
NQ = sum(len(s[1]) for s in SECTIONS); TOTAL = NQ * SHORT_PTS + len(CASES) * CASE_PTS; PASS = round(TOTAL * 0.8)

def cover(story, key=False):
    class Cover(Flowable):
        def wrap(self, aw, ah): return CW, 26 * mm
        def draw(self):
            c = self.canv; logo(c, 9 * mm, 15 * mm, 9 * mm)
            c.setFont("DVB", 12); c.setFillColor(INK); c.drawString(22 * mm, 17 * mm, "Clopos Retention Academy")
            c.setFont("DV", 9.5); c.setFillColor(MUT); c.drawString(22 * mm, 12.5 * mm, "Отдел Retention · программа обучения стажёров")
    story += [Cover()]
    story += [Paragraph("КЛЮЧ ДЛЯ ПРОВЕРЯЮЩЕГО" if key else "СЕРТИФИКАЦИОННЫЙ ТЕСТ", S_EYE), Spacer(1, 2 * mm),
              Paragraph("Сертификация сотрудника отдела Retention" if not key else "Эталонные ответы и критерии оценки", S_H1), Spacer(1, 4 * mm),
              Paragraph(("Итоговая проверка после 6 дней обучения: продукт Clopos, регламент и задачи отдела, MRR, экономика заведения, скрипт, онбординг клиента и реальные рабочие ситуации."
                         if not key else "Документ для наставника или руководителя отдела. Не передавайте его стажёру до окончания проверки."), S_LEAD),
              Spacer(1, 6 * mm)]

def build_test(fn):
    doc = Doc(fn, "Сертификационный тест Retention Clopos", "Сертификационный тест")
    s = []; cover(s)
    rows = [["ФИО стажёра", "f_name"], ["Дата", "f_date"], ["Наставник / проверяющий", "f_mentor"], ["Время начала и окончания", "f_time"]]
    t = Table([[Paragraph(a, S_CELLB), SmallField(b, CW - 58 * mm)] for a, b in rows], colWidths=[58 * mm, CW - 58 * mm], rowHeights=11 * mm)
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    s += [t, Spacer(1, 7 * mm)]
    s += [info_box([
        "<b>Как проходить тест</b>",
        f"• Все {NQ + len(CASES)} вопросов — открытые: отвечайте своими словами, полными предложениями. Вариантов ответа нет.",
        "• Поля для ответа можно заполнить прямо в PDF (Adobe Acrobat Reader, браузер Chrome или Edge) или распечатать тест и писать от руки.",
        "• Время — 3 часа. Демо-кабинет, сайт обучения, записи и помощь коллег не используются.",
        "• Где вопрос просит назвать раздел Clopos, пишите путь так, как в кабинете: например, «Склад → Инвентаризация».",
        "• Если не знаете ответ полностью, напишите то, что знаете: частичный ответ оценивается частью баллов.",
    ]), PageBreak(), Paragraph("Структура теста", S_H2), Spacer(1, 3 * mm)]
    srows = [[Paragraph("<b>Раздел</b>", S_CELL), Paragraph("<b>Вопросов</b>", S_CELL), Paragraph("<b>Баллов</b>", S_CELL)]]
    for i, (title, qs) in enumerate(SECTIONS, 1): srows.append([Paragraph(f"{i}. {title}", S_CELL), Paragraph(str(len(qs)), S_CELL), Paragraph(str(len(qs) * SHORT_PTS), S_CELL)])
    srows.append([Paragraph(f"{len(SECTIONS) + 1}. Рабочие ситуации (кейсы)", S_CELL), Paragraph(str(len(CASES)), S_CELL), Paragraph(str(len(CASES) * CASE_PTS), S_CELL)])
    srows.append([Paragraph("<b>Итого</b>", S_CELL), Paragraph(f"<b>{NQ + len(CASES)}</b>", S_CELL), Paragraph(f"<b>{TOTAL}</b>", S_CELL)])
    t = Table(srows, colWidths=[CW - 50 * mm, 25 * mm, 25 * mm])
    t.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE), ("BACKGROUND", (0, 0), (-1, 0), SOFT), ("BACKGROUND", (0, -1), (-1, -1), SOFT),
                           ("TOPPADDING", (0, 0), (-1, -1), 2 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm), ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm)]))
    s += [t, Spacer(1, 5 * mm),
          Paragraph(f"<b>Тест сдан</b>, если набрано не менее <b>{PASS} из {TOTAL} баллов</b> (80%). Вопросы разделов 1–{len(SECTIONS)} — до {SHORT_PTS} баллов, кейсы — до {CASE_PTS} баллов.", S_BODY),
          Spacer(1, 4 * mm)]
    n = 0
    for i, (title, qs) in enumerate(SECTIONS, 1):
        s += section_title(i, title, f"{len(qs)} вопросов · до {SHORT_PTS} баллов за каждый")
        for q, lines, _ in qs:
            n += 1
            s.append(KeepTogether([qhead(n, q, SHORT_PTS), Spacer(1, 2.2 * mm), Field(f"q{n:02d}", lines, tooltip=f"Ответ на вопрос {n}"), Spacer(1, 6 * mm)]))
    s += [PageBreak()] + section_title(len(SECTIONS) + 1, "Рабочие ситуации (кейсы)",
          f"{len(CASES)} ситуаций · до {CASE_PTS} баллов за каждую. Опишите, что вы спросите, что сделаете в Clopos и о чём договоритесь с клиентом.")
    for q, lines, _ in CASES:
        n += 1
        s.append(KeepTogether([qhead(n, q, CASE_PTS), Spacer(1, 2.2 * mm), Field(f"q{n:02d}", lines, tooltip=f"Ответ на кейс {n}"), Spacer(1, 6 * mm)]))
    s += [CondPageBreak(70 * mm), Spacer(1, 4 * mm), Paragraph("Подтверждение", S_H2), Spacer(1, 2 * mm),
          Paragraph("Я выполнил(а) тест самостоятельно, без использования материалов и помощи.", S_BODY), Spacer(1, 4 * mm)]
    t = Table([[Paragraph("Подпись стажёра", S_CELLB), SmallField("sign_intern", 70 * mm)], [Paragraph("Подпись проверяющего", S_CELLB), SmallField("sign_mentor", 70 * mm)],
               [Paragraph("Итоговый балл (заполняет проверяющий)", S_CELLB), SmallField("score_total", 70 * mm)]], colWidths=[CW - 70 * mm, 70 * mm], rowHeights=12 * mm)
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    s.append(t)
    doc.build(s)

def build_key(fn):
    doc = Doc(fn, "Ключ к сертификационному тесту Retention Clopos", "Ключ для проверяющего — не выдавать стажёру")
    s = []; cover(s, key=True)
    s += [info_box([
        "<b>Как оценивать</b>",
        f"• Вопросы 1–{NQ}: <b>2 балла</b> — ответ верный и полный, своими словами; <b>1 балл</b> — верно по сути, но неполно или с одной неточностью; <b>0</b> — неверно или нет ответа.",
        f"• Кейсы {NQ + 1}–{NQ + len(CASES)}: <b>5 баллов</b> — есть выяснение причины, решение через Clopos, соблюдён регламент (без обещаний и скидок без согласования), конкретная договорённость и запись в CRM; <b>3–4</b> — пропущен один-два элемента; <b>1–2</b> — только общие слова; <b>0</b> — неверно или нарушает регламент.",
        "• Эталон — ориентир, а не обязательная формулировка. Засчитывайте ответы своими словами, если смысл верный.",
        f"• Тест сдан при <b>{PASS} из {TOTAL}</b> баллов (80%). При недоборе разберите ошибки со стажёром и назначьте пересдачу.",
    ]), PageBreak(), Paragraph("Лист результатов", S_H2), Spacer(1, 3 * mm)]
    rows = [[Paragraph("<b>Раздел</b>", S_CELL), Paragraph("<b>Максимум</b>", S_CELL), Paragraph("<b>Набрано</b>", S_CELL)]]
    for i, (title, qs) in enumerate(SECTIONS, 1): rows.append([Paragraph(f"{i}. {title}", S_CELL), Paragraph(str(len(qs) * SHORT_PTS), S_CELL), SmallField(f"sec{i}", 28 * mm, 7 * mm)])
    rows.append([Paragraph(f"{len(SECTIONS) + 1}. Рабочие ситуации (кейсы)", S_CELL), Paragraph(str(len(CASES) * CASE_PTS), S_CELL), SmallField(f"sec{len(SECTIONS) + 1}", 28 * mm, 7 * mm)])
    rows.append([Paragraph("<b>Итого</b>", S_CELL), Paragraph(f"<b>{TOTAL}</b>", S_CELL), SmallField("total", 28 * mm, 7 * mm)])
    t = Table(rows, colWidths=[CW - 62 * mm, 30 * mm, 32 * mm])
    t.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE), ("BACKGROUND", (0, 0), (-1, 0), SOFT), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                           ("TOPPADDING", (0, 0), (-1, -1), 1.5 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm), ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm)]))
    s += [t, Spacer(1, 4 * mm)]
    t = Table([[Paragraph("Стажёр", S_CELLB), SmallField("k_name", CW - 45 * mm)], [Paragraph("Проверяющий", S_CELLB), SmallField("k_mentor", CW - 45 * mm)],
               [Paragraph("Решение", S_CELLB), SmallField("k_result", CW - 45 * mm)]], colWidths=[45 * mm, CW - 45 * mm], rowHeights=11 * mm)
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    s += [t, PageBreak()]
    n = 0
    def keyblock(n, q, a, pts):
        box = Table([[Paragraph("<b>Эталон:</b> " + a, S_KEY)]], colWidths=[CW - 11 * mm])
        box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), SOFT), ("LEFTPADDING", (0, 0), (-1, -1), 3.5 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 3.5 * mm),
                                 ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm), ("ROUNDEDCORNERS", [2 * mm] * 4)]))
        wrap = Table([["", box]], colWidths=[11 * mm, CW - 11 * mm])
        wrap.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
        return KeepTogether([qhead(n, q, pts), Spacer(1, 2 * mm), wrap, Spacer(1, 5 * mm)])
    for i, (title, qs) in enumerate(SECTIONS, 1):
        s += section_title(i, title, f"{len(qs)} вопросов · до {SHORT_PTS} баллов")
        for q, _, a in qs:
            n += 1; s.append(keyblock(n, q, a, SHORT_PTS))
    s += section_title(len(SECTIONS) + 1, "Рабочие ситуации (кейсы)", f"до {CASE_PTS} баллов за каждую")
    for q, _, a in CASES:
        n += 1; s.append(keyblock(n, q, a, CASE_PTS))
    doc.build(s)

if __name__ == "__main__":
    out = sys.argv[1]
    build_test(os.path.join(out, "Clopos_Retention_сертификационный_тест.pdf"))
    build_key(os.path.join(out, "Clopos_Retention_ключ_для_проверяющего.pdf"))
    from pypdf import PdfReader, PdfWriter
    for f in os.listdir(out):
        if f.endswith(".pdf"):
            p = os.path.join(out, f); r = PdfReader(p); w = PdfWriter(clone_from=r); w.set_need_appearances_writer(True)
            with open(p, "wb") as fh: w.write(fh)
            print(f, len(r.pages), "pages,", len(r.get_fields() or {}), "fields")

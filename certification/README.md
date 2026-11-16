# Финальный тест стажёра отдела Retention / Yakuniy test

- `Clopos_Retention_финальный_тест_RU.pdf` — русский вариант.
- `Clopos_Retention_yakuniy_test_UZ.pdf` — o‘zbekcha variant.
- `Clopos_Retention_лист_оценки_RU.pdf`, `Clopos_Retention_baholash_varaqasi_UZ.pdf` — лист оценки для наставника (эталон, критерии, баллы, итог). Стажёру не выдаётся.

Структура (100 баллов, сдан при 80): A — 10 теоретических вопросов (30), B — запись в CRM по ситуации (30), C — проблемная ситуация (20), D — ролевая игра с проверяющим (20). Поля можно заполнить в PDF или распечатать.

Изменить текст: `source/texts.py`, пересобрать: `python3 certification/source/final.py certification` (тест) и `python3 certification/source/sheet.py certification` (лист оценки, тексты в `source/sheet_texts.py`) (нужны reportlab и pypdf).

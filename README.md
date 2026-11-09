# Clopos Retention Academy

Сайт: https://clopos-retention-academy.netlify.app · база данных: Supabase, проект `lfnaxkdvmtpuigcvznab`.

## O'zbekcha: qisqacha

- Sayt 3 tilda: русский, o'zbekcha, English (yuqoridagi til tanlash menyusi).
- Istalgan kishi ro'yxatdan o'tadi va darhol **stajyor** sifatida kursga kiradi.
- **lsona2422@gmail.com** — egasi (owner): doim administrator, uni o'chirib yoki rolini o'zgartirib bo'lmaydi.
- Administrator **«Jamoa va ruxsatlar»** bo'limida barcha foydalanuvchilarni ko'radi: rol beradi, murabbiy biriktiradi, ismini o'zgartiradi, **xatsiz yangi parol qo'yadi**, pochtani tasdiqlaydi, natijalarni nolga tushiradi, bloklaydi yoki o'chiradi.
- Har bir foydalanuvchi o'z parolini saytning yuqorisidagi **«Parolni o'zgartirish»** tugmasi bilan o'zgartiradi.
- Supabase'ning standart pochtasi butun loyiha uchun **soatiga 2 ta xat** yuboradi. Shuning uchun **Authentication → Sign In / Providers → Email → Confirm email** ni o'chirib qo'ying.

## O'zbekcha: GitHub'ga joylash

1. https://github.com/new sahifasini oching, **Repository name** maydoniga `clopos-academy` deb yozing va **Create repository** tugmasini bosing.
2. Ochilgan sahifada **uploading an existing file** havolasini bosing.
3. Arxivni oching (unzip). `clopos-academy-github` papkasi **ichidagi barcha fayl va papkalarni** (`index.html`, `config.js`, `README.md`, `js`, `media`, `supabase`, `vendor`) belgilab, brauzer oynasiga sudrab tashlang.
4. Pastdagi **Commit changes** tugmasini bosing.

**GitHub Pages orqali sayt sifatida ochish (ixtiyoriy):**
1. Repozitoriyda **Settings → Pages** bo'limini oching.
2. **Source**: `Deploy from a branch`, **Branch**: `main`, papka `/ (root)` ni tanlang va **Save** bosing.
3. 1–2 daqiqadan keyin sayt manzili paydo bo'ladi: `https://FOYDALANUVCHI-NOMI.github.io/clopos-academy/`.
4. Bu manzilni Supabase'ga qo'shing: **Authentication → URL Configuration → Redirect URLs → Add URL**. Aks holda xatlardagi havolalar Netlify saytiga olib boradi.

`config.js` faylidagi `anon public` kalit ochiq bo'lishi mumkin, u sayt uchun mo'ljallangan. `service_role`, `sbp_…`, `nfp_…` kalitlarini **hech qachon** repozitoriyga qo'shmang.

---

# Как запустить сайт

Сайт обучения стажёров отдела Retention: 6 дней уроков, видео и тренажёры по демо-кабинету, 90 вопросов в проверках дней и 150 в трёх итоговых тестах. Регистрация по почте, роли «Администратор», «Наставник», «Стажёр». Наставник видит прогресс и результаты своих стажёров.

Сайт состоит из обычных файлов. Данные пользователей хранит бесплатный сервис **Supabase**. Пока он не подключён, сайт работает в **демо-режиме**: аккаунты и прогресс сохраняются только в браузере, в котором их создали.

Запуск занимает примерно 20 минут.

---

## Шаг 1. Создайте базу данных в Supabase

1. Откройте https://supabase.com, нажмите **Start your project** и войдите (можно через GitHub или почту).
2. Нажмите **New project**:
   - **Name** — например, `clopos-academy`;
   - **Database Password** — придумайте и сохраните;
   - **Region** — ближайший, например `Central EU (Frankfurt)`.
3. Дождитесь, пока проект создастся (1–2 минуты).

## Шаг 2. Создайте таблицы

1. В левом меню проекта откройте **SQL Editor**, нажмите **New query**.
2. Откройте файл `supabase/schema.sql` из этой папки, скопируйте его целиком и вставьте в редактор.
3. Нажмите **Run**. Должно появиться `Success. No rows returned`.

В этом файле указано, что **lsona2422@gmail.com** — владелец: эта почта всегда администратор, её роль нельзя изменить, а аккаунт — удалить (это проверяет сама база данных). Все остальные сразу после регистрации получают роль «Стажёр» и могут проходить курс.

## Шаг 3. Подключите сайт к базе

1. В Supabase откройте **Project Settings → API**.
2. Скопируйте **Project URL** и ключ **anon public**.
3. Откройте файл `config.js` в любом текстовом редакторе и вставьте их:

```js
window.ACADEMY_CONFIG = {
  supabaseUrl: "https://ВАШ-ПРОЕКТ.supabase.co",
  supabaseAnonKey: "ВАШ-КЛЮЧ-anon-public",
  adminEmail: "lsona2422@gmail.com"
};
```

Ключ `anon public` можно хранить в файле сайта, он для этого предназначен. Данные защищены правилами доступа из `schema.sql`. Ключ `service_role` в сайт **не вставляйте**.

## Шаг 4. Разместите сайт в интернете

Проще всего через Netlify:

1. Откройте https://app.netlify.com/drop и войдите.
2. Перетащите в окно **всю папку** `clopos-academy`.
3. Netlify выдаст адрес вида `https://название.netlify.app`. Это адрес вашего сайта, его можно переименовать в настройках Netlify.

## Шаг 5. Укажите адрес сайта в Supabase

1. В Supabase откройте **Authentication → URL Configuration**.
2. В **Site URL** вставьте адрес сайта из шага 4.
3. В **Redirect URLs** добавьте тот же адрес.

Без этого ссылки из писем (подтверждение почты и восстановление пароля) будут вести не туда.

## Шаг 6. Письма с подтверждением

Встроенная почта Supabase отправляет **всего несколько писем в час**. Для команды есть два варианта:

- **Отключить подтверждение почты.** Откройте **Authentication → Sign In / Providers → Email** и выключите **Confirm email**. Тогда человек попадает в курс сразу после регистрации. Если оставить включённым, сначала нужно подтвердить почту по ссылке из письма.
- **Подключить свою почту.** В **Authentication → Emails → SMTP Settings** укажите SMTP вашей почты.

## Шаг 7. Начало работы

1. Откройте сайт и зарегистрируйтесь с почтой **lsona2422@gmail.com**. Вы станете администратором.
2. Отправьте адрес сайта сотрудникам. Они регистрируются сами и сразу попадают в курс как **стажёры**.
3. Откройте **«Команда и доступы»** — там список всех зарегистрированных:
   - смените роль: **Стажёр**, **Наставник**, **Администратор** или **Доступ закрыт** (блокировка);
   - стажёру выберите наставника;
   - **Имя** — исправить имя сотрудника;
   - **Сбросить** — обнулить весь прогресс; в «Подробнее» можно сбросить результат одного дня или теста;
   - **Удалить** — удалить аккаунт вместе с прогрессом.
   - **Пароль** — задать сотруднику новый пароль без писем (почта при этом подтверждается);
   - **Подтвердить почту** — если письмо с подтверждением не пришло.

Каждый сотрудник может сменить свой пароль сам: кнопка **«Сменить пароль»** в шапке сайта.

> Стандартная почта Supabase отправляет **всего 2 письма в час на весь проект**. Поэтому лучше выключить **Confirm email** (шаг 6) и восстанавливать пароли через кнопку **«Пароль»** в панели. Если нужны письма — подключите свой SMTP (шаг 6), после этого лимит можно поднять в **Authentication → Rate Limits**.
4. Наставник в разделе **«Мои стажёры»** видит закреплённых за ним стажёров: пройденные дни, результаты проверок и итоговых тестов (лучший и последний результат, число попыток, вопросы с ошибками), практические задания, просмотренные видео и тренажёры, последнюю активность.

Стажёру дни открываются по порядку: следующий день — после проверки на 80% и выше, итоговые тесты — после дня 6. Наставнику и администратору открыто всё.

---

## Как менять содержание

| Что поменять | Файл |
|---|---|
| Вопросы проверок дней (по 15) | `js/questions-ru-days.js`, `js/questions-uz-days.js`, `js/questions-en-days.js` |
| Вопросы итоговых тестов (по 50) | `js/questions-ru-exams.js`, `js/questions-uz-exams.js`, `js/questions-en-exams.js` |
| Тексты уроков, практика, модули, глоссарий | `js/content-ru.js`, `js/content-uz.js`, `js/content-en.js` |
| Надписи интерфейса на трёх языках | `js/i18n.js` |
| Видео и тренажёры | папка `media/` и `js/tours.js` |
| Цвета и оформление | блок `<style>` в `index.html` |

В вопросах **первым всегда пишется правильный вариант**: на экране варианты перемешиваются сами.

После изменений снова перетащите папку в Netlify (шаг 4) или загрузите обновлённые файлы.

## Что где лежит

```
index.html               — сайт
config.js                — подключение к Supabase
supabase/schema.sql      — таблицы и правила доступа
vendor/supabase.js       — библиотека Supabase (версия 2.45.4)
js/                      — содержание, вопросы, логика
media/                   — видео (mp4) и скриншоты тренажёров из демо-кабинета
```

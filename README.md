# لوحة تحكم المبيعات (Sales Dashboard)

مشروع React كامل وجاهز للتشغيل، مبني حول الكومبوننت اللي رفعته (`SalesDashboard.jsx`)،
مع دعم الاتصال المباشر بجوجل شيت عن طريق Apps Script Web App.

## المميزات الأساسية
- داشبورد رئيسي بمؤشرات الأداء (KPIs)، فلاتر (يوم/فرع/موظف/نظام/طريقة دفع)، رسوم بيانية.
- **إجمالي العهدة** كمؤشر مجمّع، و**أقل موظف مبيعًا** (لعموم البيانات ولكل فرع)، و**مقارنة الشهر الحالي بالشهر السابق** مع نسبة التغيّر.
- تبويب **"تقرير الجرد"**: تقرير احترافي جاهز للطباعة/PDF يقدر صاحب العمل يراجعه أو يوقّعه — فيه اسم المنشأة، رقم التقرير وتاريخه، إجمالي عام، وجدول مطابقة لكل فرع وموظف (كاش/محفظة/تحويل/أخرى/عهدة/إجمالي)، وخانتين توقيع (المدير / أمين الخزينة).

## المتطلبات
- Node.js نسخة 18 أو أحدث

## التشغيل محليًا

```bash
npm install
npm run dev
```

هيفتح المشروع على `http://localhost:5173`.

## البناء للنشر (Production build)

```bash
npm run build
npm run preview
```

الملفات الناتجة هتكون في مجلد `dist/` وممكن ترفعها على أي استضافة استاتيك
(Netlify, Vercel, GitHub Pages, ...).

## ربط جوجل شيت (اختياري)

الداشبورد بيقرأ البيانات من جوجل شيت متصل بفورم، من غير ما يخلي الشيت نفسه عام.
ده بيتم عن طريق سكريبت صغير (Apps Script) موجود في مجلد `apps-script/Code.gs`:

1. افتح الشيت المرتبط بالفورم بتاعك.
2. من القائمة: **Extensions → Apps Script**.
3. امسح أي كود موجود، وانسخ محتوى ملف `apps-script/Code.gs` والصقه.
4. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone with the link**
5. انسخ رابط الـ Web App (بينتهي بـ `/exec`).
6. من داخل الداشبورد، افتح ⚙️ إعدادات → "ربط Apps Script Web App" وحط الرابط هناك.

ترتيب الأعمدة المتوقع في الشيت (بدون تغيير):

```
0 الطابع الزمني        1 البريد الإلكتروني     2 اسم الموظف
3 النظام               4 الفرع                 5 العهدة
6 مبيعات الكاش         7 مبيعات المحفظة        8 مبيعات التحويلات البنكية
9 مبيعات وسائل أخرى    10 ملاحظات إضافية
```

## هيكل المشروع

```
sales-dashboard/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── apps-script/
│   └── Code.gs          # سكريبت الربط بجوجل شيت
├── .github/workflows/
│   └── deploy.yml        # نشر تلقائي على GitHub Pages
└── src/
    ├── main.jsx
    ├── index.css
    └── components/
        └── SalesDashboard.jsx
```

## النشر على GitHub Pages

المشروع فيه GitHub Action جاهز (`.github/workflows/deploy.yml`) بيعمل build ونشر تلقائي
في كل مرة تعملي فيها push على فرع `main`. خطوات النشر:

1. **اعملي ريبو جديد على GitHub** (Public أو Private، الاتنين شغالين مع Pages).
2. **ارفعي المشروع** من جهازك:
   ```bash
   cd sales-dashboard
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo-name>.git
   git push -u origin main
   ```
3. **فعّلي GitHub Pages:**
   - في الريبو: **Settings → Pages**
   - تحت **Build and deployment → Source** اختاري **GitHub Actions**
4. الـ Action هيشتغل تلقائيًا (تقدري تتابعيه من تاب **Actions** في الريبو). بعد ما يخلص
   (حوالي دقيقة)، هيظهرلك الرابط النهائي في نفس تاب Pages، شكله عادة:
   ```
   https://<username>.github.io/<repo-name>/
   ```
5. أي `git push` جديد على `main` بعد كده هيعمل تحديث تلقائي للموقع المنشور.

**ملحوظة:** لو الريبو اسمه بيبدأ بـ `<username>.github.io` (يعني موقعك الشخصي مش مشروع فرعي)،
الموقع هيظهر على `https://<username>.github.io/` مباشرة من غير مسار فرعي — والمشروع شغال
في الحالتين لأنه مبني بمسارات نسبية (`base: "./"` في `vite.config.js`).


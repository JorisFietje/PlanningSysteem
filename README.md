# 🏥 Patiënt Planning Simulatie v2.0

Een moderne web-based simulatie programma voor het inplannen van patiënten op een agenda, met werkdruk analyse en optimalisatie suggesties. Gebouwd met **React**, **Next.js**, **Tailwind CSS** en **Prisma**.

## ✨ Functies

### 📅 Patiënt Planning
- Voeg patiënten toe aan het dagschema
- Plan patiënten op specifieke tijden
- Visuele weergave van de dagplanning (07:00 - 19:00)
- Data opslag in database via Prisma

### 📋 Behandelings Tracking
- Voeg handelingen toe per patiënt
- Registreer tijdsduur per handeling
- Koppel medewerkers aan handelingen
- Overzicht van alle handelingen per patiënt
- Persistente data opslag

### 📊 Werkdruk Analyse
- Automatische berekening van werkdruk per 15-minuten tijdslot
- Interactieve grafiek met Chart.js
- Visuele grafiek met gekleurde indicatoren:
  - 🟢 Groen: Lage drukte (1-2 patiënten)
  - 🟡 Oranje: Gemiddelde drukte (2-3 patiënten)
  - 🔴 Rood: Hoge drukte (4+ patiënten)
- Gedetailleerd overzicht per tijdslot

### 💡 Optimalisatie Suggesties
- Detectie van piek momenten
- Identificatie van onderbenutte tijdslots
- Analyse van dag verdeling (ochtend vs middag)
- Clustering detectie
- Capaciteit waarschuwingen
- Concrete aanbevelingen voor betere spreiding

### 📈 Statistieken Dashboard
- Totaal aantal patiënten
- Totaal aantal handelingen
- Drukste tijdslot
- Maximaal aantal gelijktijdige patiënten

## 🚀 Technologie Stack

- **Frontend**: React 18, Next.js 14 (App Router)
- **Styling**: Tailwind CSS 3
- **Database**: Prisma ORM met SQLite (development) / PostgreSQL (production)
- **Visualisatie**: Chart.js + React Chart.js 2
- **TypeScript**: Type-safe development
- **API**: Next.js API Routes (RESTful)

## 📦 Installatie

### Vereisten
- Node.js 18+ en npm/yarn/pnpm
- Git (optioneel)

### Stappen

1. **Clone of download het project:**
   ```bash
   cd /Users/jorisfietje/SideQuests/Showcase
   ```

2. **Installeer dependencies:**
   ```bash
   npm install
   # of
   yarn install
   # of
   pnpm install
   ```

3. **Setup de database:**
   ```bash
   # Genereer Prisma Client
   npx prisma generate
   
   # Push database schema
   npx prisma db push
   ```

4. **Start development server:**
   ```bash
   npm run dev
   # of
   yarn dev
   # of
   pnpm dev
   ```

5. **Open in browser:**
   ```
   http://localhost:3000
   ```

## 🗄️ Database Configuratie

### Development (SQLite)
De applicatie gebruikt standaard SQLite voor development. Het `.env` bestand bevat:
```env
DATABASE_URL="file:./dev.db"
```

### Production (PostgreSQL/MySQL)
Voor productie, pas het `.env` bestand aan:

**PostgreSQL:**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/patient_planning?schema=public"
```

**MySQL:**
```env
DATABASE_URL="mysql://user:password@localhost:3306/patient_planning"
```

Update ook `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"  // of "mysql"
  url      = env("DATABASE_URL")
}
```

Daarna run:
```bash
npx prisma migrate dev --name init
```

## 📖 Gebruikshandleiding

### 1. Patiënt Toevoegen
1. Vul de naam van de patiënt in
2. Selecteer de geplande tijd
3. Klik op "Patiënt Toevoegen"
4. De patiënt wordt opgeslagen in de database en verschijnt in het schema

### 2. Handelingen Toevoegen
1. Selecteer een patiënt uit de dropdown
2. Vul de naam van de handeling in (bijv. "Intake", "Behandeling", "Controle")
3. Geef de duur in minuten op
4. Vul de naam van de uitvoerende medewerker in
5. Klik op "Handeling Toevoegen"
6. De handeling wordt opgeslagen en verschijnt in het behandelingsvak

### 3. Werkdruk Analyseren
1. Klik op "📊 Analyseer Werkdruk"
2. Bekijk de interactieve grafiek met werkdruk per 15-minuten tijdslot
3. Controleer de gedetailleerde lijst onder de grafiek
4. Identificeer piek momenten (rood gemarkeerd)

### 4. Planning Optimaliseren
1. Klik op "⚡ Optimaliseer Planning"
2. Lees de intelligente suggesties voor verbetering
3. Pas de planning handmatig aan op basis van de suggesties
4. Analyseer opnieuw om het resultaat te controleren

### 5. Data Wissen
1. Klik op "🗑️ Alles Wissen"
2. Bevestig de actie
3. Alle data wordt uit de database verwijderd

## 🎯 Voorbeeld Workflow

```
1. Voeg patiënten toe:
   - Jan Jansen om 09:00
   - Marie Pieters om 09:30
   - Kees de Vries om 10:00
   - Lisa van Dam om 14:00

2. Voeg handelingen toe per patiënt:
   - Jan: Intake (15 min, Dr. Smit) + Behandeling (30 min, Dr. Smit)
   - Marie: Controle (20 min, Nurse Peters)
   - Kees: Behandeling (45 min, Dr. de Jong)
   - Lisa: Intake (15 min, Dr. Smit) + Behandeling (30 min, Dr. Smit)

3. Analyseer werkdruk:
   - Bekijk grafiek
   - Identificeer piek tussen 09:00-10:00
   
4. Optimaliseer:
   - Lees suggesties
   - Overweeg Marie te verplaatsen naar 11:00
   - Analyseer opnieuw om verbetering te zien
```

## 🏗️ Project Structuur

```
showcase/
├── app/
│   ├── api/
│   │   ├── patients/
│   │   │   ├── route.ts           # GET, POST, DELETE patiënten
│   │   │   └── [id]/route.ts      # GET, DELETE specifieke patiënt
│   │   └── actions/
│   │       ├── route.ts           # GET, POST handelingen
│   │       └── [id]/route.ts      # DELETE specifieke handeling
│   ├── globals.css                # Tailwind CSS
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Hoofdpagina
├── components/
│   ├── PatientForm.tsx            # Formulier voor patiënten
│   ├── ActionForm.tsx             # Formulier voor handelingen
│   ├── Statistics.tsx             # Statistieken dashboard
│   ├── ScheduleBoard.tsx          # Dagplanning visualisatie
│   ├── TreatmentBoxes.tsx         # Behandelingsvakken
│   ├── WorkloadAnalysis.tsx       # Werkdruk analyse & grafiek
│   ├── OptimizationSuggestions.tsx # Optimalisatie suggesties
│   └── Notification.tsx           # Toast notificaties
├── lib/
│   └── prisma.ts                  # Prisma client singleton
├── prisma/
│   ├── schema.prisma              # Database schema
│   └── dev.db                     # SQLite database (development)
├── types/
│   └── index.ts                   # TypeScript types
├── utils/
│   └── workload.ts                # Werkdruk berekeningen
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

## 🔌 API Endpoints

### Patiënten
- `GET /api/patients` - Haal alle patiënten op (met handelingen)
- `POST /api/patients` - Maak nieuwe patiënt aan
- `DELETE /api/patients` - Verwijder alle patiënten
- `GET /api/patients/[id]` - Haal specifieke patiënt op
- `DELETE /api/patients/[id]` - Verwijder specifieke patiënt

### Handelingen
- `GET /api/actions` - Haal alle handelingen op
- `POST /api/actions` - Maak nieuwe handeling aan
- `DELETE /api/actions/[id]` - Verwijder specifieke handeling

## 🛠️ Development Scripts

```bash
# Start development server
npm run dev

# Build voor productie
npm run build

# Start productie server
npm run start

# Run linter
npm run lint

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Push database schema changes
npm run prisma:push

# Create and apply migrations
npm run prisma:migrate
```

## 🎨 Tailwind CSS Customization

De applicatie gebruikt een custom Tailwind configuratie met:
- Extended color palette (primary colors)
- Custom animations (slide-in/out)
- Responsive breakpoints
- Utility classes

## 💾 Database Schema

```prisma
model Patient {
  id        String   @id @default(cuid())
  name      String
  startTime String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  actions   Action[]
}

model Action {
  id        String   @id @default(cuid())
  name      String
  duration  Int
  staff     String
  patientId String
  patient   Patient  @relation(...)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## 🌐 Browser Compatibiliteit
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 💡 Tips & Best Practices

1. **Plan realistische tijden**: Houd rekening met 5-10 minuten tussen patiënten
2. **Verdeel over de dag**: Vermijd clustering aan het begin van de dag
3. **Gebruik de analyse**: Kijk regelmatig naar de werkdruk grafiek
4. **Let op capaciteit**: Meer dan 4 gelijktijdige patiënten is vaak te druk
5. **Balanceer ochtend/middag**: Streef naar gelijke verdeling
6. **Database backups**: Maak regelmatig backups van je database
7. **Type safety**: Profiteer van TypeScript voor minder bugs

## 🔮 Toekomstige Uitbreidingen

Mogelijke verbeteringen:
- [ ] Drag & drop functionaliteit voor patiënten
- [ ] Export functionaliteit (PDF/Excel)
- [ ] Meerdere kamers/behandelruimtes
- [ ] Personeelsplanning met vaardigheden
- [ ] Automatische optimalisatie (AI-gestuurd)
- [ ] Multi-dag planning
- [ ] Recurring appointments
- [ ] Email notificaties
- [ ] Real-time updates (WebSockets)
- [ ] Mobile app (React Native)

## 🐛 Troubleshooting

### Database errors
```bash
# Reset database
rm prisma/dev.db
npx prisma db push
```

### Module not found errors
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Port already in use
```bash
# Change port
PORT=3001 npm run dev
```

## 📝 Licentie

Dit project is gemaakt als showcase en kan vrij gebruikt worden voor educatieve en demonstratie doeleinden.

## 👤 Auteur

Gemaakt voor het SideQuests Showcase project.

## 🤝 Bijdragen

Dit is een demonstratie project. Suggesties en feedback zijn welkom!

---

**Veel succes met het plannen! 🎉**

**Powered by React ⚛️ + Next.js + Tailwind CSS 🎨 + Prisma 🔷**
![1762871481695](image/README/1762871481695.png)
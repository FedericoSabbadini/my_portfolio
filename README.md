# Portfolio Modulare - Federico Sabbadini

Un sito portfolio completamente modulare e data-driven. Tutto il contenuto è gestito tramite file JSON nella cartella `data/`.

## 📁 Struttura del Progetto

```
portfolio/
├── index.html              # Home page
├── about.html              # About & Contacts
├── courses.html            # Corsi e Certificazioni
├── news.html               # News e Aggiornamenti
├── resources.html          # Progetti e Risorse
│
├── data/                   # 📝 MODIFICA QUESTI FILE PER AGGIORNARE IL CONTENUTO
│   ├── site.json           # Configurazione sito (nav, CTA)
│   ├── personal.json       # Dati personali, stats, lingue, interessi
│   ├── education.json      # Timeline educazione
│   ├── projects.json       # Progetti (featured e tutti)
│   ├── courses.json        # Corsi universitari
│   ├── certifications.json # Certificazioni professionali
│   └── news.json           # News e aggiornamenti
│
├── components/             # Componenti HTML riutilizzabili
│   ├── navbar.html
│   └── footer.html
│
├── css/                    # Stili CSS
│   ├── base.css            # Variabili e stili base
│   ├── navigation.css      # Stili navigazione
│   ├── components.css      # Stili componenti
│   └── pages.css           # Stili pagine specifiche
│
├── js/                     # JavaScript
│   ├── data-loader.js      # Caricamento dati JSON
│   ├── template-renderer.js # Rendering template
│   ├── component-loader.js # Caricamento componenti
│   └── app.js              # App principale
│
└── assets/
    └── images/             # Immagini
        └── profile.jpeg
```

## 🔧 Come Modificare il Contenuto

### Dati Personali (`data/personal.json`)
Modifica nome, titolo, bio, email, social media, statistiche, lingue e interessi.

```json
{
  "personal": {
    "name": "Il tuo nome",
    "title": "Il tuo titolo",
    "tagline": "La tua descrizione breve",
    "bio": ["Paragrafo 1", "Paragrafo 2"],
    "email": "email@example.com",
    "topSkills": ["Skill 1", "Skill 2"]
  },
  "stats": [
    { "number": "106", "label": "GPA", "sublabel": "/110" }
  ],
  "languages": [...],
  "interests": [...]
}
```

### Progetti (`data/projects.json`)
Aggiungi o modifica progetti. Divisi in `featured` (in evidenza) e `all` (tutti).

```json
{
  "featured": [
    {
      "title": "Nome Progetto",
      "period": "Nov 2025 - Present",
      "badge": "AI/ML",
      "badgeClass": "badge-info",
      "description": "Descrizione del progetto...",
      "tags": ["Python", "TensorFlow"],
      "url": "https://github.com/..."
    }
  ],
  "all": [...]
}
```

### Corsi (`data/courses.json`)
Organizzati per livello (masters, bachelors).

```json
{
  "masters": {
    "title": "Master's Degree Courses",
    "subtitle": "Università • Anno",
    "courses": [
      {
        "name": "Nome Corso",
        "grade": "30/30",
        "description": "Descrizione...",
        "tags": ["Tag1", "Tag2"]
      }
    ]
  }
}
```

### Certificazioni (`data/certifications.json`)

```json
{
  "certifications": [
    {
      "title": "Nome Certificazione",
      "issuer": "EC-Council",
      "issuerIcon": "ec-council",
      "date": "October 2025",
      "certId": "123456",
      "description": "Descrizione...",
      "tags": ["Tag1"],
      "featured": true
    }
  ]
}
```

### News (`data/news.json`)

```json
{
  "news": [
    {
      "year": "2025",
      "showYear": true,
      "icon": "🏆",
      "title": "Titolo News",
      "description": "Descrizione...",
      "tags": ["Tag1", "Tag2"]
    }
  ]
}
```

### Education (`data/education.json`)

```json
{
  "education": [
    {
      "degree": "M.Sc. in Computer Engineering",
      "institution": "University of Brescia",
      "period": "Sep 2024 - Oct 2026",
      "status": "current",
      "statusLabel": "Current",
      "statusBadge": "badge-success",
      "gpa": "106/110",
      "description": "Descrizione...",
      "thesis": {
        "title": "Titolo Tesi",
        "url": "https://..."
      }
    }
  ]
}
```

## 🎨 Classi Badge Disponibili

- `badge-primary` - Blu (default)
- `badge-success` - Verde
- `badge-warning` - Arancione
- `badge-info` - Viola
- `badge-danger` - Rosso

## 🔌 Icone Certificazioni

- `ec-council` - EC-Council (rosso scuro)
- `polimi` - Politecnico di Milano (blu scuro)
- `udemy` - Udemy (viola)
- `unibs` - Università di Brescia (blu)

## 🚀 Avvio Locale

Per testare il sito in locale, usa un server HTTP (necessario per il caricamento dei JSON):

```bash
# Python 3
python -m http.server 8000

# Node.js (se hai installato http-server)
npx http-server

# PHP
php -S localhost:8000
```

Poi apri `http://localhost:8000` nel browser.

## ✏️ Personalizzazione Rapida

1. **Cambiare nome/info**: Modifica `data/personal.json`
2. **Aggiungere un progetto**: Aggiungi un oggetto in `data/projects.json`
3. **Aggiungere una news**: Aggiungi un oggetto in `data/news.json`
4. **Aggiungere una certificazione**: Aggiungi in `data/certifications.json`
5. **Cambiare foto profilo**: Sostituisci `assets/images/profile.jpeg`

## 📱 Responsive

Il sito è completamente responsive e si adatta a:
- Desktop (> 1024px)
- Tablet (768px - 1024px)
- Mobile (< 768px)

---

Made with ❤️ for modularity

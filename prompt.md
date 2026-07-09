Tu es un développeur senior full stack et un product designer exigeant. Développe une application de productivité complète appelée OneFocus, basée sur la méthodologie du livre "The One Thing" (Passez à l'essentiel) de Gary Keller. L'application est destinée à un jeune qui touche à tout et se disperse. Le but : l'aider dans son travail ET son quotidien, le forcer à faire UNE seule chose à la fois, tracer ce qu'il fait réellement de ses journées, et lui donner ENVIE d'ouvrir l'application chaque jour grâce à une expérience immersive.

Stack technique imposée
Backend : Node.js + Express (ou Fastify), API REST
Base de données : SQLite via better-sqlite3 (fichier local, zéro config) avec une couche d'abstraction propre pour migrer vers PostgreSQL plus tard
Frontend : PWA — Vue 3 ou Svelte (pas de Next.js) — SPA servie par le serveur Node
PWA obligatoire : manifest.json complet (icônes 192/512 maskable, theme_color, display: standalone), Service Worker avec cache-first pour le shell et network-first pour l'API, installable sur mobile ET desktop
Notifications : Firebase Cloud Messaging (FCM) :

Intègre le SDK Firebase côté client (firebase/messaging) avec firebase-messaging-sw.js pour la réception en arrière-plan
Côté serveur : firebase-admin pour envoyer les notifications (data + notification payloads, actions cliquables)
Stocke les tokens FCM en base, gère le refresh des tokens et la suppression des tokens invalides
Prévois un fallback Notification API locale si FCM indisponible
Documente dans le README la création du projet Firebase et où mettre les clés (fichier .env + serviceAccountKey.json, jamais commités)
Scheduler côté serveur (node-cron) qui déclenche tous les envois programmés
Responsive :

Mobile : bottom navigation bar fixe, gestes tactiles (swipe pour compléter/reporter une tâche), safe-area iOS
Desktop : sidebar gauche, layout multi-colonnes
Breakpoint ~768px
Philosophie de l'application (principes du livre à implémenter)
1. La Question Déterminante (Focusing Question)
Chaque jour à l'ouverture : « Quelle est la SEULE chose que tu peux faire aujourd'hui, telle qu'en la faisant, tout le reste deviendra plus facile ou inutile ? »
L'utilisateur choisit sa ONE Thing du jour. Elle est affichée en permanence, visuellement distincte (grande carte héros, couleur accent).

2. L'effet domino — tout est séquentiel
Une Mission (projet) contient des Tâches, chaque tâche contient des Étapes ordonnées
L'étape N+1 est verrouillée (cadenas) tant que l'étape N n'est pas terminée
Animation "domino qui tombe" à chaque étape complétée
3. Anti-multitâche — le Mode Focus (fonctionnalité centrale)
Quand l'utilisateur démarre une tâche :

Mode Focus plein écran immersif : seule la tâche active existe, le reste de l'app est verrouillé (sortie uniquement via confirmation "Abandonner la session ?")
Timer en grand : Pomodoro configurable (25/5 défaut) OU time block libre
Barre de progression circulaire animée autour du timer + progression linéaire des étapes
Étapes cochables une par une pendant la session
Fin de timer : notification FCM + son doux + écran de bilan (étapes faites, temps réel)
Détection d'interruption via visibilitychange, comptée dans les stats
La règle n°1, appliquée serveur ET client : jamais deux tâches actives en même temps
4. Time Blocking
Vue calendrier journalière, création de blocs par drag
Notification FCM au début de chaque time block : "C'est l'heure de : [tâche]"
L'app recommande de placer la ONE Thing le matin
5. Rappels et rattrapage des tâches ratées
Le scheduler (node-cron, vérif toutes les 5 min) envoie via FCM :

Rappel avant échéance : configurable (1h / 30min / 15min avant)
Tâche ratée (échéance ou time block dépassé sans complétion → statut missed automatique) : "⚠️ Tu as raté : [tâche]" avec actions dans la notification : Reporter / Faire maintenant (ouvre le mode focus)
Rappel du matin : "Ta ONE Thing aujourd'hui : [tâche]" — Rappel du soir : bilan + "Quelle sera ta ONE Thing demain ?"
Onglet "En retard" avec badge rouge : chaque tâche ratée doit être reprogrammée ou abandonnée explicitement, pas de zone grise
6. Le Challenge Check-in — journal de bord toutes les 15 minutes (fonctionnalité majeure)
Un mode "Challenge" activable/désactivable, avec plage horaire configurable (ex : 8h–19h) et intervalle configurable (défaut : **15 minutes chrono**) :

Toutes les 15 min, notification FCM : « ⏱️ Check-in ! Qu'as-tu fait ces 15 dernières minutes ? »
Cliquer la notification ouvre directement l'écran de check-in, ultra-rapide à remplir (moins de 10 secondes) :

Saisie vocale via Web Speech API (SpeechRecognition, langue fr-FR) avec gros bouton micro animé (onde sonore pendant l'écoute), transcription affichée et éditable — fallback saisie texte si l'API n'est pas dispo
OU saisie texte rapide
Sélection de la catégorie en un tap (chips) : Travail client, Dev perso, Admin/Emails, Apprentissage, Pause, Distraction, Sport, Perso… (catégories personnalisables avec couleur et icône)
Tag automatique : si une session focus était en cours, le check-in est pré-rempli avec la tâche active
Les check-ins manqués sont visibles dans une timeline de la journée (trous = zones grises) et rattrapables
Streak de check-ins : gamification du taux de réponse (%, badges)
Pendant une session focus, option "Ne pas interrompre mon focus" : les check-ins sont suspendus et un seul check-in récapitulatif est demandé à la fin de la session
7. Bilans de productivité — journalier, hebdomadaire, mensuel, annuel (fonctionnalité majeure)
Génération automatique de rapports à partir des check-ins, sessions focus, tâches et time blocks :

Bilan journalier (notification FCM le soir, heure configurable) :

Timeline de la journée reconstituée à partir des check-ins (frise horaire colorée par catégorie)
Répartition du temps par catégorie (donut chart), temps focalisé vs dispersé, ONE Thing accomplie ou non, tâches faites/ratées, nombre d'interruptions
Score de productivité du jour (0–100) calculé à partir de : ONE Thing faite, ratio focus/distraction, taux de check-ins, tâches complétées vs ratées — formule documentée et ajustable
Comparaison avec hier et avec la moyenne des 7 derniers jours
Bilan hebdomadaire (dimanche soir) : évolution du score, meilleures/pires plages horaires, catégorie dominante, temps par mission, tendance du streak 66 jours
Bilan mensuel : progression vers les objectifs mensuels (cascade 411), heatmap du mois, records
Bilan annuel : rétrospective type "Year in review" — total d'heures focalisées, missions accomplies, évolution mois par mois, moments forts
Tous les bilans sont consultables dans l'onglet Stats (navigation jour/semaine/mois/année) et exportables (partage image du bilan)
8. Classification des tâches — pas de limite, mais un tri impitoyable
Aucune limite au nombre de tâches ajoutées. En revanche, toute tâche créée DOIT être classée à la création :

Matrice d'Eisenhower obligatoire : chaque tâche reçoit un type parmi :

🔴 Urgente + Importante → à faire aujourd'hui, remonte en haut
🟠 Importante, non urgente → à planifier (l'app propose un time block)
🟡 Urgente, non importante → à déléguer ou traiter vite, marquée "voleur de temps potentiel"
⚪ Ni urgente ni importante → va dans "Un jour peut-être", masquée de la vue du jour
Vue matrice 2×2 interactive (drag & drop entre quadrants) en plus de la vue liste
Champs additionnels : mission, échéance, durée estimée, tags libres
L'app trie automatiquement la vue "Aujourd'hui" par quadrant puis échéance, et suggère la ONE Thing parmi les 🔴/🟠 liées aux objectifs
Capture rapide inbox toujours présente (bouton central) : on peut capturer sans classer, mais un item d'inbox non classé sous 24h déclenche un rappel "Vide ton inbox"
9. La méthode 411 — objectifs en cascade
Someday → 1 an → Mois → Semaine → Jour (ONE Thing) → Maintenant (tâche active). Chaque tâche peut être rattachée à un objectif ; les tâches "hors objectif" sont signalées discrètement.

10. L'habitude des 66 jours
Streak tracker de la ONE Thing accomplie, objectif visuel 66 jours, heatmap style GitHub.

Modèle de données (minimum)
copy


users (id, name, settings_json)
missions (id, title, description, goal_id, color, status, created_at)
tasks (id, mission_id, title, description, due_date, quadrant[urgent_important|important|urgent|neither], status[todo|active|done|missed|abandoned|someday], estimated_minutes, is_one_thing, order, tags_json, created_at, completed_at)
steps (id, task_id, title, order, done, done_at)
time_blocks (id, task_id, date, start_time, end_time)
focus_sessions (id, task_id, started_at, ended_at, planned_minutes, actual_minutes, interruptions, completed)
checkins (id, timestamp, content, input_mode[voice|text], category_id, task_id NULL, missed BOOL)
categories (id, name, color, icon, is_productive BOOL)
reports (id, period[day|week|month|year], period_key, score, data_json, generated_at)
goals (id, level[someday|year|month|week], title, parent_goal_id, deadline)
inbox_items (id, content, created_at, processed)
fcm_tokens (id, user_id, token, device_info, updated_at)
streaks (id, date, one_thing_done, checkin_rate)
Écrans / Navigation
Bottom-nav mobile (5 onglets) :

🎯 Aujourd'hui — ONE Thing en héros, timeline des check-ins du jour, time blocks, tâches triées par quadrant, bouton "Démarrer le focus"
📋 Missions — missions → tâches → étapes, vue liste + vue matrice Eisenhower
➕ Capture (bouton central surélevé, accessible partout) — inbox rapide + raccourci check-in vocal
📊 Bilans — journalier / hebdo / mensuel / annuel, score, graphiques, heatmap 66 jours
⚙️ Réglages — mode Challenge (intervalle, plage horaire), catégories, horaires de rappels, Pomodoro, notifications FCM, objectifs 411
Desktop : sidebar gauche, "Aujourd'hui" en 2–3 colonnes (timeline check-ins | tâches | time blocks).
+ Mode Focus : overlay plein écran, et + écran Check-in : modal plein écran mobile ultra-rapide.

UX/UI — Expérience immersive (exigence forte)
L'app doit donner ENVIE d'être ouverte. Ce n'est pas un formulaire CRUD, c'est un compagnon quotidien :

Direction artistique : sombre par défaut (fond quasi-noir profond, pas de gris terne) avec un dégradé subtil animé en arrière-plan, une couleur accent chaude (ambre/orange = énergie du focus), toggle clair. Typographie soignée : une display expressive pour les titres/le score, une sans lisible pour le contenu, chiffres monospace/tabular pour les timers
Micro-interactions partout : domino qui tombe à chaque étape cochée, haptic feedback (navigator.vibrate) sur mobile, transitions fluides entre écrans (view transitions API si dispo), chips de catégories qui rebondissent au tap, onde sonore animée autour du bouton micro pendant la dictée
Moments de célébration : ONE Thing terminée → animation plein écran sobre mais gratifiante (confetti discret + message), palier de streak (7, 21, 66 jours) → badge animé, fin de session focus → écran de bilan avec compteur qui s'incrémente
Le mode focus est un sanctuaire : ambiance visuelle dédiée (fond encore plus sombre, tout s'efface sauf le timer et la tâche), option de sons d'ambiance (bruit blanc/pluie/lofi via fichiers audio locaux), cercle de progression qui respire lentement
Les bilans doivent être beaux : le score du jour en très grand avec animation de comptage, frise horaire colorée élégante, graphiques animés à l'apparition (donut, barres) — l'utilisateur doit avoir envie de voir son bilan le soir comme on ouvre son Spotify Wrapped
L'écran d'accueil raconte la journée : salutation contextuelle ("Bonjour Adrien ☀️ Prêt pour ta ONE Thing ?"), état d'avancement du jour visible d'un coup d'œil, prochaine échéance en évidence
Vitesse perçue : skeleton loaders, optimistic UI (une action est visuellement instantanée, la synchro suit), 60fps sur les animations (transform/opacity uniquement)
Accessibilité : zones tactiles ≥ 44px, contrastes AA, prefers-reduced-motion respecté
Exigences techniques
firebase-messaging-sw.js gère push + notificationclick avec actions, app fermée incluse
Offline-first : actions hors ligne (check-in, cocher étape, capturer) en queue IndexedDB, synchro au retour réseau ; les check-ins vocaux hors ligne stockent le texte transcrit localement
Web Speech API pour la dictée (webkitSpeechRecognition fallback), gestion des permissions micro propre
Génération des rapports : job cron quotidien qui agrège et stocke dans reports (les bilans passés restent consultables même hors ligne)
Mono-utilisateur, token local simple, pas d'auth complexe
Scripts npm : npm run dev, npm start, npm run db:init (base + données de démo réalistes pour voir les bilans remplis)
.env.example complet (clés Firebase), README : setup Firebase/FCM pas à pas, installation PWA Android/iOS/desktop, activation micro et notifications. Note iOS : PWA installée sur l'écran d'accueil requise pour les push (iOS 16.4+), et Web Speech limité sur iOS → toujours proposer le fallback texte
Structure : /server (routes, services, scheduler, fcm, db, reports) — /client (composants, sw, manifest)
Tests sur la logique critique : verrouillage séquentiel, détection des tâches ratées, unicité de la tâche active, calcul du score de productivité, agrégation des rapports
Comportements clés à ne pas rater
Jamais deux tâches actives en même temps (serveur + client)
Tâche dépassée non complétée → missed automatique + notification FCM avec actions
Toute nouvelle tâche doit avoir un quadrant Eisenhower avant d'être sauvegardée (sauf items d'inbox, à classer sous 24h)
Check-in : de la notification au check-in enregistré en moins de 10 secondes, vocal ou texte
Étapes strictement séquentielles ; le mode focus survit au refresh (état persisté)
Le bilan journalier doit exister même avec des données partielles (check-ins manqués = "temps non tracé", affiché honnêtement)
Ordre de développement : structure + DB + serveur → shell PWA (manifest, SW, bottom-nav responsive) → mode focus → intégration FCM + scheduler → check-ins (vocal + texte + catégories) → bilans (jour d'abord, puis semaine/mois/année) → matrice Eisenhower + objectifs 411 → polish UX/UI et animations. Avance étape par étape et vérifie que chaque partie fonctionne avant de passer à la suivante.
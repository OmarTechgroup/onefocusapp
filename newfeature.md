Nouvelle fonctionnalité : Texte du jour (citation inspirante)

Ajoute à OneFocus une fonctionnalité "Texte du jour" :

Comportement


Chaque jour, une citation est affichée sur l'écran Aujourd'hui, juste sous la salutation, dans une carte élégante (typographie display, guillemets stylisés, nom de l'auteur en petit)
Sélection aléatoire SANS répétition dans le même mois : algorithme → au début de chaque mois, mélanger (shuffle) la liste des citations actives et les consommer dans cet ordre ; une citation déjà affichée ce mois-ci ne peut pas réapparaître avant le mois suivant. Persister l'état (citation du jour + file du mois) en base pour que la citation reste la même toute la journée, même après refresh ou sur un autre appareil
La citation du jour est aussi incluse dans la notification FCM du matin ("Ta ONE Thing aujourd'hui : [tâche] — 💬 [citation]")
Tap sur la carte → écran citation en plein écran (fond dégradé, belle typo) avec bouton Partager en image (génération canvas → PNG)
Une citation aléatoire courte s'affiche aussi sur l'écran de fin de session focus et dans le bilan journalier

je veut aussi que la citation du jour soit envoyer par notification aussi chaque matin et le soir une citation que tu a suggerer qui ne fait pas partir des 80 citation deja 

Gestion des citations (CRUD utilisateur)


Dans Réglages → "Mes citations" : lister, ajouter, modifier, désactiver, supprimer des citations
Formulaire d'ajout : texte (obligatoire), auteur/source (optionnel), catégorie (focus, discipline, action, priorités, habitudes, vision, échec/persévérance)
Import des citations par défaut au db:init depuis un fichier seeds/quotes.json
Possibilité de marquer une citation en ❤️ favori ; option "afficher plus souvent mes favoris" (pondération dans le shuffle)


Modèle de données

quotes (id, text, author, category, is_custom BOOL, is_active BOOL, is_favorite BOOL, created_at)
quote_history (id, quote_id, shown_date UNIQUE)

Seed : seeds/quotes.json

Intègre les 80 citations ci-dessous comme données par défaut. Format :

json[{ "text": "...", "author": "...", "category": "..." }]


PACK DE 80 CITATIONS

A. Citations célèbres sur le focus et l'essentiel (thèmes du livre)


« Celui qui court deux lièvres à la fois n'en attrape aucun. » — Proverbe russe (focus)
« Le succès demande du dévouement singulier envers un but unique. » — Vince Lombardi (focus)
« Je ne crains pas l'homme qui a pratiqué 10 000 coups une fois, mais celui qui a pratiqué un coup 10 000 fois. » — Bruce Lee (focus)
« L'homme qui déplace une montagne commence par déplacer de petites pierres. » — Confucius (action)
« Le secret pour avancer, c'est de commencer. » — Mark Twain (action)
« Ce n'est pas que nous ayons peu de temps, c'est que nous en perdons beaucoup. » — Sénèque (priorités)
« La simplicité est la sophistication suprême. » — Léonard de Vinci (priorités)
« Il n'y a pas de vent favorable pour celui qui ne sait pas où il va. » — Sénèque (vision)
« Un voyage de mille lieues commence toujours par un premier pas. » — Lao Tseu (action)
« La discipline est le pont entre les objectifs et les accomplissements. » — Jim Rohn (discipline)
« Nous sommes ce que nous faisons de manière répétée. L'excellence est donc une habitude. » — Aristote (d'après Will Durant) (habitudes)
« Que tu penses être capable ou incapable, dans les deux cas tu as raison. » — Henry Ford (vision)
« Le meilleur moment pour planter un arbre était il y a vingt ans. Le deuxième meilleur moment, c'est maintenant. » — Proverbe chinois (action)
« Concentrez toutes vos pensées sur la tâche en cours. Les rayons du soleil ne brûlent que concentrés. » — Alexander Graham Bell (focus)
« Je n'ai pas échoué. J'ai trouvé 10 000 moyens qui ne fonctionnent pas. » — Thomas Edison (échec/persévérance)
« La perfection est atteinte non quand il n'y a plus rien à ajouter, mais quand il n'y a plus rien à retirer. » — Antoine de Saint-Exupéry (priorités)
« L'avenir appartient à ceux qui croient à la beauté de leurs rêves. » — Eleanor Roosevelt (vision)
« Le génie, c'est un pour cent d'inspiration et quatre-vingt-dix-neuf pour cent de transpiration. » — Thomas Edison (discipline)
« Fais de ta vie un rêve, et d'un rêve, une réalité. » — Antoine de Saint-Exupéry (vision)
« Choisissez un travail que vous aimez et vous n'aurez pas à travailler un seul jour de votre vie. » — Confucius (vision)
« Peu importe la lenteur à laquelle tu avances, tant que tu ne t'arrêtes pas. » — Confucius (échec/persévérance)
« La chance sourit aux esprits préparés. » — Louis Pasteur (discipline)
« Ce que nous faisons aujourd'hui décide de ce que sera le monde demain. » — Marie von Ebner-Eschenbach (action)
« Ne dites pas : je n'ai pas le temps. Vous avez exactement le même nombre d'heures que Pasteur, Michel-Ange et Einstein. » — D'après H. Jackson Brown Jr. (priorités)
« Notre plus grande gloire n'est pas de ne jamais tomber, mais de nous relever à chaque chute. » — Confucius (échec/persévérance)
« L'action est la clé fondamentale de tout succès. » — Pablo Picasso (action)
« Vis comme si tu devais mourir demain. Apprends comme si tu devais vivre toujours. » — Gandhi (vision)
« Celui qui veut réussir trouve un moyen, celui qui veut ne rien faire trouve une excuse. » — Proverbe arabe (discipline)
« Il y a plus de courage que de talent dans la plupart des réussites. » — Félix Leclerc (échec/persévérance)
« On ne subit pas l'avenir, on le fait. » — Georges Bernanos (action)
« Le succès, c'est d'aller d'échec en échec sans perdre son enthousiasme. » — Attribué à Winston Churchill (échec/persévérance)
« Là où se porte ton attention, se porte ton énergie. » — Adage (focus)
« Rien de grand ne s'est accompli dans le monde sans passion. » — Hegel (vision)
« Commencez par le nécessaire, puis le possible, et soudain vous réaliserez l'impossible. » — Attribué à Saint François d'Assise (action)
« La constance est la vertu par laquelle toutes les autres portent leurs fruits. » — Arturo Graf (habitudes)
« Ils ne savaient pas que c'était impossible, alors ils l'ont fait. » — Attribué à Mark Twain (vision)
« Une once d'action vaut une tonne de théorie. » — Attribué à Friedrich Engels (action)
« Le temps, c'est de l'argent. » — Benjamin Franklin (priorités)
« Tu ne peux pas traverser la mer simplement en regardant l'eau. » — Rabindranath Tagore (action)
« Sois le changement que tu veux voir dans le monde. » — Attribué à Gandhi (action)


B. Maximes originales inspirées des principes de "The One Thing"

(reformulations libres des idées du livre — pas de texte extrait de l'ouvrage)


« Quelle est la SEULE chose qui, une fois faite, rendra tout le reste plus facile ou inutile ? » — La question déterminante (focus)
« Tout n'a pas la même importance. Trouve ton domino de tête. » — Principe One Thing (priorités)
« Fais tomber le premier domino, et laisse la réaction en chaîne travailler pour toi. » — Principe One Thing (action)
« Le multitâche est l'art de rater plusieurs choses à la fois. » — Principe One Thing (focus)
« Une to-do list dit ce que tu pourrais faire. Une liste de succès dit ce que tu DOIS faire. » — Principe One Thing (priorités)
« Ta volonté est une batterie : dépense-la d'abord sur ce qui compte le plus. » — Principe One Thing (discipline)
« Bloque du temps pour ta priorité comme tu bloquerais un rendez-vous avec ton avenir. » — Principe One Thing (discipline)
« Protège ton time block comme un chirurgien protège sa salle d'opération. » — Principe One Thing (focus)
« Dire oui à tout, c'est dire non à l'essentiel. » — Principe One Thing (priorités)
« Chaque « non » prononcé est un « oui » offert à ta ONE Thing. » — Principe One Thing (priorités)
« 66 jours. C'est le prix d'une habitude qui travaillera ensuite pour toi à vie. » — Principe One Thing (habitudes)
« Tu n'as pas besoin de plus de discipline, tu as besoin de meilleures habitudes. » — Principe One Thing (habitudes)
« L'équilibre parfait est un mensonge : ose déséquilibrer ta journée vers ce qui compte. » — Principe One Thing (priorités)
« Vois grand, vise haut : on ne dépasse jamais la taille de ses propres questions. » — Principe One Thing (vision)
« Les résultats extraordinaires naissent d'un focus étroit, pas d'un effort large. » — Principe One Thing (focus)
« Le succès se construit séquentiellement : une chose à la fois, pas tout à la fois. » — Principe One Thing (action)
« Ta journée appartient à ta première heure. » — Principe One Thing (discipline)
« Quand tout semble urgent, rien n'est important. Choisis. » — Principe One Thing (priorités)
« La question n'est pas « que puis-je faire ? » mais « que dois-je faire en premier ? » » — Principe One Thing (priorités)
« Un objectif sans lien avec aujourd'hui n'est qu'un rêve bien rangé. » — Principe One Thing (vision)
« Relie ton geste de maintenant à ton objectif de toujours. » — Principe One Thing (vision)
« Les distractions ne se combattent pas, elles se privent d'accès. » — Principe One Thing (focus)
« Ce que tu fais dans tes 15 prochaines minutes est ta vraie priorité, que tu le veuilles ou non. » — Principe One Thing (focus)
« Vivre en priorité, c'est décider une fois le matin et exécuter toute la journée. » — Principe One Thing (discipline)
« La maîtrise n'est pas une destination, c'est le chemin que tu empruntes chaque jour. » — Principe One Thing (habitudes)
« Ne cherche pas à être occupé. Cherche à être productif. Ce n'est pas la même vie. » — Principe One Thing (priorités)
« Un grand succès n'est que la somme de petites concentrations répétées. » — Principe One Thing (habitudes)
« Refuse la journée par défaut. Conçois ta journée par design. » — Principe One Thing (discipline)
« Ton environnement vote chaque jour pour ou contre ton objectif. Choisis tes électeurs. » — Principe One Thing (habitudes)
« La clarté précède le succès : si tu ne sais pas quoi faire, ta seule tâche est de le découvrir. » — Principe One Thing (vision)


C. Maximes originales pour un freelance / développeur


« Livrer une fonctionnalité finie vaut mieux que dix commencées. » — OneFocus (action)
« Ton code d'aujourd'hui est le domino de ton produit de demain. » — OneFocus (action)
« Chaque notification ignorée pendant le focus est une victoire silencieuse. » — OneFocus (focus)
« Le contexte switching est l'impôt invisible du développeur. Réduis tes impôts. » — OneFocus (focus)
« Une session profonde de 2 heures vaut une journée de travail fragmenté. » — OneFocus (focus)
« Ferme les onglets. Ouvre l'essentiel. » — OneFocus (priorités)
« Ton futur client remerciera le focus de ton présent. » — OneFocus (vision)
« Débogue ta journée comme ton code : trouve la cause racine de ta dispersion. » — OneFocus (discipline)
« Commit du jour : une ONE Thing terminée. Le reste est refactoring. » — OneFocus (action)
« Tu n'as pas raté ta journée tant qu'il reste un check-in pour la reprendre en main. » — OneFocus (échec/persévérance)



Instructions finales pour Claude Code


Convertis les 80 citations ci-dessus en seeds/quotes.json (champs : text, author, category), importées au db:init
Implémente la rotation aléatoire mensuelle sans répétition décrite plus haut, l'affichage sur l'écran Aujourd'hui, la notification du matin, l'écran plein écran partageable, et le CRUD "Mes citations" dans les Réglages
Prévois le cas où l'utilisateur désactive beaucoup de citations : si le pool actif est inférieur au nombre de jours du mois, autoriser la répétition uniquement après épuisement du pool
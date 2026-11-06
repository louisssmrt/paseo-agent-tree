Arbre d'agents remplace la liste plate de workspaces de la barre latérale par un arbre : machine, puis projet, puis agent, puis sous-agents.

Chaque machine connectée est une racine, grisée et marquée hors ligne si elle ne répond pas. Un projet porte le nom du dossier du workspace, jamais celui de la branche git. Les agents non archivés sont rangés sous leur projet, du plus récent au plus ancien, avec un petit point de statut à droite : vert en cours, orange permission demandée, rouge erreur, rien au repos. Chaque niveau se déplie et se replie, et l'état est mémorisé. Le nom de chaque machine est écrit dans sa propre couleur, bleu pour la machine locale par défaut.

Les sous-agents viennent de deux sources. Les agents Paseo lancés par un autre agent sont rangés sous leur parent grâce à l'étiquette `paseo.parent-agent-id`. Les sous-agents Claude Code lancés avec l'outil Agent ou Task sont lus à la fin de la timeline de chaque agent récent et affichés avec leur description et leur statut. Les sous-agents sont repliés par défaut, et une ligne repliée indique combien elle en contient.

Les agents dont le dossier est temporaire ou système (tmp, temp, /tmp, /private/tmp, C:\Windows, System32) sont masqués tant que vous ne les réaffichez pas.

## Réglages

Ils s'ouvrent depuis l'engrenage de la première ligne de machine, par clic droit ou appui long sur une machine, ou dans Réglages, Plugins. Les changements s'appliquent immédiatement. Par machine : nom affiché, couleur (palette ou hexadécimal) et masquage. Globalement : remplacement de la liste native, dossiers temporaires, affichage et limite des sous-agents, agents archivés et fermés (masqués ou grisés), tri, longueur des titres (30, 40 ou 60), points de statut, compteurs de sous-agents, marge au-dessus de l'arbre, et dépliage par défaut des machines, projets et agents.

## Données et confidentialité

Le plugin lit la liste des agents et des workspaces de chaque machine connectée, ainsi que la fin de la timeline d'un agent pour y trouver les appels de sous-agents. Désactiver les sous-agents arrête ces lectures. Rien n'est envoyé hors de l'application et le plugin ne fait aucune requête réseau de son côté. Les préférences sont enregistrées dans les réglages de plugin Paseo de l'hôte sélectionné.

## Limites

Le remplacement de la liste native fonctionne sur bureau et web seulement. Il masque la liste native avec des règles CSS qui ciblent les attributs `data-testid` de Paseo, donc une mise à jour de Paseo peut le casser. Si les éléments attendus sont introuvables, rien n'est masqué et un avertissement est écrit une seule fois dans la console de l'application. Sur mobile, la liste native reste et l'arbre s'affiche au-dessus.

Un clic sur un sous-agent Claude Code ouvre son agent parent, car un sous-agent n'a pas d'onglet propre. Les timelines sont lues pour les 40 agents les plus récemment mis à jour de chaque machine. Nécessite Paseo 0.15.0 ou plus récent.

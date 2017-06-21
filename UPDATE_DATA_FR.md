# Mise a jour des données.

## Lancer la procédure de mise a jour depuis le projet X.


----------

 

 - Lancer le projet X dans Visual Studio
 - Lancer la compilation
 - Choisir le type de donnée a mettre a jour (Wordpress / Drupal)
 


----------

## Ajout des données dans le projet whatsbehind

 - Aller dans le dossier contenant les données de Wordpress / Drupal
 - Copier le dossier
 - Supprimer le dossier whatsbehind_data/(Wordpress / Drupal)
 - Coller le dossier précédemment copié
 - Commit & Push 

## Mise a jour du lien git de whatsbehind_data dans whatsbehind



Entrer dans le répertoire du sous module whatsbehind_data:

    cd whatsbehind/data

Pull le repo depuis le dossier data:

    git pull origin master

Retourner dans le dossier whatsbehind et vérifier le statut:

    cd ..
    git status

Si le sous module viens d'être mis a jour quelque chose comme ceci devrait s'afficher:

    # Not currently on any branch.
    # Changed but not updated:
    #   (use "git add ..." to update what will be committed)
    #   (use "git checkout -- ..." to discard changes in working directory)
    #
    #       modified:   whatsbehind/data (new commits)
    #

Commiter la mise a jour:

    git add whatsbehind/data
    git commit -m "whatsbehind_data submodule updated DD/MM/YYYY"

## Mise a jour du fichier package.json

Modifier la version en x.x.n+1 sinon le module ne pourra pas être mis a jour sur NPM.






# Update data.

## Launch update procedure from X project.


----------

 

 - Launch X project in Visual Studio
 - Compile it
 - Choose data type to update (Wordpress / Drupal)
 


----------

## Update data in Whatsbehind project

 - Go to folder containing Wordpress / Drupal data
 - Copy this folder
 - delete whatsbehind_data/(Wordpress / Drupal) folder
 - Paste the folder previously copied
 - Commit & Push 

## Update whatsbehind_data submodule in whatsbehind



Go to the whatsbehind_data submodule folder:

    cd whatsbehind/data

Pull the repo from data folder:

    git pull origin master

Go back to whatsbehind folder and check update:

    cd ..
    git status

If the submodule have been updated something like that should appear:

    # Not currently on any branch.
    # Changed but not updated:
    #   (use "git add ..." to update what will be committed)
    #   (use "git checkout -- ..." to discard changes in working directory)
    #
    #       modified:   whatsbehind/data (new commits)
    #

Commit the update:

    git add whatsbehind/data
    git commit -m "whatsbehind_data submodule updated DD/MM/YYYY"

## Update package.json file

Update the version to x.x.n+1 otherwise NPM won't accept the update.

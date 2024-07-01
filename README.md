# About Abstraction
Abstraction is a character creator app designed for larp. Because "Abstraction" is a programming concept I will refer to this app as "the character creator"
to avoid confusion.

Also, it's best to read this document in order, and follow all steps in order.

The character creator was built using the following:
- [SvelteKit](https://kit.svelte.dev), a framework for building Web User Interfaces using Svelte
- [Svelte](https://svelte.dev), a component-based front-end software framework
- [Node.js](https://nodejs.org/en) - a JavaScript runtime environment
- [`npm`](https://www.npmjs.com) - Node Package Manager, the default pakage manager for Node.js
- [`nvm`](https://github.com/nvm-sh/nvm) - Node Version Manager, which manages installation of multiple Node.js versions, and can install `npm` as well
- [Firestore](https://firebase.google.com/docs/firestore) - Google's cloud-based NoSQL database.
- [Firebase Authentication](https://firebase.google.com/docs/auth) - Google's Firebase manages all user authentication for the characer creator.

Key concepts:
- Using Svelte and SvelteKit, the character creator uses both server-side rendering (SSR) and client-side rendering. I recommend reading on SSR as a concept if you
you are not familiar. The SvelteKit documentation will explain how SvelteKit controls what is rendered where.
- All content within the character creator are managed through Firestore. So whenever a designer creates an asset or a participant builds a character, that's in Firestore.
- Users are authenticated through Firebase Authentication. The charactger creator server redirects all authentication to Firebase, so the character creator never stores passwords,
just the user tokens returned by Firebase. 
- While SvelteKit can be deployed to many places (including Firebase hosting), we have only ever deployed this application to [Vercel](https://vercel.com/home).


# Setting Up Your Dev Environment
This project requires `npm`. There are many ways you can install `npm`. I recommend following [the official `npm` documentation](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm),
which recommends that you install [`nvm`](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating). For Mac and Linux, this is straightfoward and you can simply follow the
linked instructions for `npm` and `nvm` (starting with the `npm` instructions).

For Windows, it's a little messier. I highly recommend you follow Microsoft's advice and do the following:
- Install Windows Subsystem for Linux (WSL). I recommend installing Ubuntu as your Linux distribution.
- Install Windows Terminal (an improved command line).
- Install `nvm` _inside your WSL Linux distribution_.
- Use `nvm` to install `npm` (in Linux).
- Install VS Code with 
While this takes some work upfront, it is much easier and more stable to develop inside of Linux (via WSL) than in Windows. 
All the steps above are covered described in detail in this article from Microsoft:
[Install Node.js on Windows Subsystem for Linux (WSL2)](https://learn.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-wsl).
I followed these instructions to set up my dev environment and I can confirm they work.

## Setting up your IDE
While you can use whatever IDE you want (or no IDE), Visual Studio Code does work and is free. The Windows link above describes how to set up
VS Code for Windows (integrating with the WSL). VS Code is also available for Linux and Mac - [download link](https://code.visualstudio.com/download).

If you install VS Code, I recommend the following plugins:
- WSL (if you're using WSL)
- Remote Development
- HTML CSS Support
- Svelte Inellisense
- Svelte for VS Code

If you're using WSL, open a Windows Terminal, type `Ubuntu` to launch the WSL. (This command will be different if you didn't install Ubuntu). Then navigate to this
directory and type `code .`. In Linux or Mac,  you can launch VS Code normally and then open this directory as a project.

## Setting up Firebase
You will need Firebase credentials to run the application. Tod o this you need to sign up for [Firebase](https://firebase.google.com/docs/). To do this you'll need a GCP account, or someone will need to add you to theirs. Once you have Firebase enabled, go to [the firebase console](https://console.firebase.google.com).
- Create a project. ***Do not use Reverie's production Firebase project for testing***, becuase you can break
larps that are in active development or are actively being used by participants. Name it what you'd like.
- Create an app for your project for the character creator. Use the "web app" option that looks like `</>`.
  Name the app whatever you like, but "character creator" is an obvious choice.
- Go to Project Settings -> Service Accounts and create a service account for the character creator server. Save this as a json file and 
do not lose it! This is your private key.
- Create a Firestore Database for your project. (_Not "Realtime Database"_). You can leave this database empty, the character creator will populate
it automatically.
- Enable Authentication, and choose Email/Password and Google as your sign-in providers.


# Setting up and running the app locally
All of the following commands should be run from the project root - the same directory that this file is in.
## Installing requirements
Run `npm install` to install all the requirements for the app.

## Initial Setup
The character creator requires several environment variables to run. You should create a file in project root. Name the file `.env`. 
The `.env` file needs the following entries.
`VITE_JWT_KEY` this should be a randomly generated password. It will be used to encrypt security tokens within the app.
`VITE_FIREBASE_CLIENT_CONFIG` - tells the web browser client how to talk to firebase for authentication. Within your Firebase Project Settings,
look at your app. In the "SDK setup and configuration" section, click the "Config" radio button. You'll turn the entire entry into a single line of 
JSON.
`VITE_FIREBASE_SERVER_CONFIG` - Tells the sever how to talk to firebase for authentication and for database transactions. This is a json string as 
well, wrapping the secret provided by firebase in a `"credential": {} "storageBucket": ""` block. 
Firebase can be run locally via emulation, to do so just add these three lines:
```sh
VITE_FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
VITE_FIRESTORE_EMULATOR_HOST="127.0.0.1"
VITE_FIRESTORE_EMULATOR_PORT="8080"
```

Ultimately, your `.env` file should look something like this:

```sh
VITE_FIREBASE_SERVER_CONFIG='{"credential": {"type": "service_account", "project_id": "reverie-demo", "private_key_id": "085558d9fe1600db19fac5f04408d482420d58ec", "private_key": "-----BEGIN PRIVATE KEY-----\nyour very long private key\n-----END PRIVATE KEY-----\n", "client_email": "firebase-adminsdk-abc123@your-project.iam.gserviceaccount.com", "client_id": "123456789", "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token", "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs", "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-abc123%40your-project.iam.gserviceaccount.com", "universe_domain": "googleapis.com"}, "storageBucket": "your-project.appspot.com"}'
VITE_FIREBASE_CLIENT_CONFIG='{"apiKey": "your public key", "authDomain": "your-porject.firebaseapp.com", "projectId": "your-project", "storageBucket": "your-project.appspot.com", "messagingSenderId": "123456", "appId": "1:2345:6789", "measurementId": "A-BCD1234"}'
VITE_FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
VITE_FIRESTORE_EMULATOR_HOST="127.0.0.1"
VITE_FIRESTORE_EMULATOR_PORT="8080"
VITE_JWT_KEY = "ZEbsj73LQW44eVvF4K38nAyZNgbKFsbD"
```
Note that `VITE_FIREBASE_SERVER_CONFIG` is ***not*** just the json credentials given to you by firebase. It is a large json object that
also includes the URL for your Firestore database, so it's more like `'{"crendential: PASTE_FROM_FIREBASE_HERE, "storageBucket": "your-project.appspot.com"}`.

(Most Firebase project use json files instead of massive environment variables, this is a potential enhancement for the character creator,
although of course it risks exposing the json files if the server/host is misconfigured.)

## Running locally

Now that you've done all of the above, you can finally run the application locally!
`npm run` will give you a list of options.

1. Run `npm run emulator` if you want to emulate firebase locally. This launches a web UI for the emulator, see the console output for the url.
2. Run `npm run dev` to run the character creator locally. 

Caveats: 
- Firebase emulator has a known issue where emulating Google Authentication doesn't work. It's better to use username/password
when using the emulator for authentication.
- If you strip out the firebase emulator environment variables, Firebase will probably block the incoming requests until you whitelist your IP
from [the firebase console](https://console.firebase.google.com). This isn't recommended unless you're confident you can do it.
- The character creator app will _not_ automatically detect most changes so you will need to CTRL-C kill the app and run `npm run dev` again.
- The emulator stores everything as local files so your database will persist even if you shut down the emulator and start it up again.

Once everything is up and running, you will need to manually assign someone admin roles within the application. After you've logged into
the app through the emulator, go into the emulator UI and browser the users. There should be a single user. Edit the user document so that 
the following exists in the document:
```yaml
roles
   system: 4
```
Save the changes. You should now have admin rights within the character creator.

# Developing
`npm run lint` and `npm run format` should lint and format your code. This is good be4cause it keeps the code readable and consistent, and
can even reveal mistakes you've made. (If linting and formatting just refuse to work, it may because of a syntax error or some other error.)

## CSS Themes, UI components, etc
The theme is built using [Svelte Materials UI](https://sveltematerialui.com) (`smui`). `smui` provides the foundational CSS theming
as well as a lot of the basic UI components (lists, buttons, etc). 

To edit the CSS themes, navigate to `./src/theme` (and `./src/theme/dark` for darkmode). Make changes to the `sccs` files as desired
and then run `npm smui:build`. 

# Deploying to Vercel
First, make sure you've done all the steps listed under "Setting up Firebase" above.

To deploy to Vercel, you will need to install the Vercel app in your github repo (this should already be done for this repo.) Svelte's
ability to deploy is controlled within `svelte.config.js` and the `adapter` within that file. the `adapter-auto` works with Vercel.

Go to [Vercel](https://vercel.com) and create a project. Import Git Repository and point it to this repository. Configure it
as a SvelteKite (v1) project. 

You will need the following settings:
- Build command: `npm run build`
- Output Directory: default, do not override
- Install Command: `npm install`
- Development Command: default, do not override
- Under "Root Directory", make sure "include source files outside of the root directory" is checked. Root directory can be blank.
- Node.js version: `18.x`. 
- Project ID: Default is fine.

Next, you will need to click on the "Environment Variables" tab on the right and add some environment variables:
`VITE_JWT_KEY` - this should be a long, secure password, ideally randomly generated.
`VITE_FIREBASE_CLIENT_CONFIG` - the configuration that browser clients use to talk to firebase. See "Initial Setup" above.
`VITE_FIREBASE_SERVER_CONFIG` - the configuration that the server uses to talk to firebase. See "Initial Setup" above.
These three environment variables are required, and the app will not run without them.

Finally, you will need to go to [the firebase console](https://console.firebase.google.com), click on "Authentication" on the left
and then click on "Settings". Go to "Authorized domains" and add the url for your app, e.g. `my-vercel-project.vercel.app`. If you want
to test another branch, you will need to do this again, e.g. `my-vercel-project-git-mybranchname.vercel.app`. You can do that for every
branch you want to test (or reuse the same branch name for all testing).

You can create multiple vercel apps, which is a good idea. You will want a separate deployed sandbox version of the app to test - just make sure you aren't using Reverie's production Firebase credentials! Also be aware: Any changes pushed to main will go live automatically in production. Vercel does let you preview branches with open PRs, which is also good for testing. Always test locally _and_ in your vercel sandbox before going to production!

Once Vercel has deployed your app and it's running, you will need to go to [the firebase console](https://console.firebase.google.com) and manually make someone into an admin. Find them in the list of users (by browsing the Firestore database) and set the following within the document:
```yaml
roles
   system: 4
```
Once you've done that, the user  you've elevated can promote other people to admins from within the character creator app. You only 
need to do this once. 

# Appendix

Note: This project was orginally created by [`create-svelte`](https://github.com/sveltejs/kit/tree/master/packages/create-svelte). However,
the character creator app was built using a release candidate of SvelteKit 1.0. I have since updated the app to work with SvelteKit 2.0. There
may still be some legacy weirdness from the SvelteKite 1.0 days (which used a very different API) but most issues should be fixed.

The SvelteKit documentation (and stack overflow discussions) were instrumental. [Migrating to SveleteKit v2](https://kit.svelte.dev/docs/migrating-to-sveltekit-2) was extremely important, although hopefully anyone reading this should not have to refer to that document, as
the application has already been migrated.

This app was originally created by Deeg. Further updates, bug fixes, and enhancements were created by Max Metzger.
This application is copyright Reverie Studios, 2024.
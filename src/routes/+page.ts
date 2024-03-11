import { browserPopupRedirectResolver, getRedirectResult, type UserCredential } from 'firebase/auth';
import { auth, handleSignIn } from '$lib/firebase';
import { browser } from '$app/environment';

/** @type { PageLoad } from "./$types"; */
export async function load({ parent }) {
    if (browser) {
        console.log("+page.ts checking for a redirect result, auth is ", auth);
        try {
            const result: UserCredential | null = await getRedirectResult(auth, browserPopupRedirectResolver);
            if (result) {
                console.log("+page found a redirect result, handling sign-in");
                await handleSignIn(result);
            }
        }
        catch (e) {
            console.log(e);
        }
    }
}
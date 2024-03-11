import { getRedirectResult, type UserCredential } from 'firebase/auth';
import { auth, handleSignIn } from '$lib/firebase';

/** @type { PageLoad } from "./$types"; */
export async function load({ parent }) {
    console.log("+page.ts checking for a redirect result");
    try {
        const result: UserCredential | null = await getRedirectResult(auth);
        if (result) {
            console.log("+page found a redirect result, handling sign-in");
            await handleSignIn(result);
        }
    }
    catch (e) {
        console.log(e);
    }
}
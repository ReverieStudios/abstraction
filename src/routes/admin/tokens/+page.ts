/** @type { PageLoad } from "./$types"; */
export async function load({ parent }) {
    const { user } = await parent();
    return { userID: user.uid };
}
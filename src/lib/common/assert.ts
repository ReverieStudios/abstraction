export const assert = (message: string, assertion: any) => {
	if (!assertion) {
		throw new Error(message);
	}
};

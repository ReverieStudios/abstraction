export interface Character {
	user: string;
	// with the aaddition of relationships, "assets" is now a list of both asset IDs and relationship IDs. 
	// for backwards compatibility, we cannot rename the field
	assets: string[];
	name: string;
	nameLocked: boolean;
	purchased: boolean;
}

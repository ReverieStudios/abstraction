import type {
	AuthProvider,
	GoogleAuthProvider,
	NextOrObserver,
	PopupRedirectResolver,
	UserCredential,
	User
} from 'firebase/auth';
import type { auth } from 'firebase-admin';

import type {
	CollectionReference,
	DocumentData,
	DocumentReference,
	DocumentSnapshot,
	Query,
	QuerySnapshot,
	FirestoreError,
	Unsubscribe,
	WithFieldValue,
	WriteBatch,
	FieldValue,
	WhereFilterOp,
	SetOptions,
	Transaction,
	OrderByDirection
} from 'firebase/firestore';
import type { ListResult, UploadMetadata, UploadResult } from 'firebase/storage';

export const init: (config: Object, components: Object, emulators?: Object) => Firebase;

export const Auth: () => {};
export const Storage: () => {};
export const Store: () => {};

interface Limit {
	limit: number;
}
interface SortBy {
	sortBy: string;
	direction?: OrderByDirection;
}
interface Where {
	field: string;
	value: any;
	op: WhereFilterOp;
}
export type QueryClause = SortBy | Where | Limit;

export interface Firebase {
	auth?: FirebaseAuth;
	storage?: FirebaseStorage;
	store?: Firestore;
}

export interface FirebaseAuthProviders {
	Google: GoogleAuthProvider;
}

export interface FirebaseAuth {
	signInWithEmailAndPassword: (email: string, password: string) => Promise<UserCredential>;
	createUserWithEmailAndPassword: (email: string, password: string) => Promise<UserCredential>;
	signInWithPopup: (
		provider: AuthProvider,
		resolver?: PopupRedirectResolver | undefined
	) => Promise<UserCredential>;
	signInWithRedirect: (
		provider: AuthProvider,
		resolver?: PopupRedirectResolver | undefined
	) => Promise<UserCredential>;
	signOut: () => void;
	onAuthStateChanged: (nextOrObserver: NextOrObserver<User>) => Unsubscribe;
	onIdTokenChanged: (nextOrObserver: NextOrObserver<User>) => Unsubscribe;
	decodeToken: (token: string) => Promise<auth.DecodedIdToken>;
	providers: FirebaseAuthProviders;
	getUser: (uid: string) => Promise<User>;
	updateUser: (uid: string, data: auth.UpdateRequest) => Promise<User>;
	deleteUser: (uid: string) => Promise<User>;
}

interface FieldValues {
	arrayUnion: (...elements: any[]) => FieldValue;
	arrayRemove: (...elements: any[]) => FieldValue;
	delete: () => FieldValue;
	increment: (n: number) => FieldValue;
	serverTimestamp: () => FieldValue;
}

export interface Firestore {
	generateID(): string;
	collection(path: string, queries?: QueryClause[]): Query<DocumentData>;
	doc(path: string): DocumentReference<DocumentData>;
	doc(collection: Query<DocumentData>): DocumentReference<DocumentData>;
	collectionDoc(path: string): DocumentReference<DocumentData>;
	getDoc<T>(reference: DocumentReference<T>): Promise<DocumentSnapshot>;
	getDocs<T>(query: Query<T>, fromCache?: boolean): Promise<QuerySnapshot<T>>;
	onSnapshot<T>(
		reference: DocumentReference<T>,
		onNext: (snapshot: DocumentSnapshot<T>) => void,
		onError?: (error: FirestoreError) => void,
		onCompletion?: () => void
	): Unsubscribe;
	onSnapshot<T>(
		reference: Query<T>,
		onNext: (snapshot: QuerySnapshot<T>) => void,
		onError?: (error: FirestoreError) => void,
		onCompletion?: () => void
	): Unsubscribe;
	setDoc<T>(
		reference: DocumentReference<T>,
		data: WithFieldValue<T>,
		options?: SetOptions
	): Promise<void>;
	addDoc<T>(
		reference: CollectionReference<T> | Query<T>,
		data: WithFieldValue<T>
	): Promise<DocumentReference<T>>;
	deleteDoc(reference: DocumentReference<unknown>): Promise<void>;
	writeBatch(): WriteBatch;
	runTransaction<T>(updateFn: (transaction: Transaction) => Promise<T>): Promise<T>;
	fieldValues: FieldValues;
}

export interface FirebaseStorage {
	upload(
		path: string,
		data: string | Blob | Uint8Array | ArrayBuffer,
		metadata?: UploadMetadata
	): Promise<UploadResult>;
	delete(path: string): Promise<void>;
	listAll(path: string): Promise<ListResult>;
	getDownloadURL(path: string): Promise<string>;
}

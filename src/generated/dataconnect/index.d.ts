import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface AddMovieData {
  movie_insert: Movie_Key;
}

export interface AddMovieVariables {
  title: string;
  imageUrl: string;
  genre: string;
}

export interface AddReviewData {
  review_upsert: Review_Key;
}

export interface AddReviewVariables {
  movieId: UUIDString;
  rating: number;
  reviewText: string;
}

export interface GetMovieData {
  movie?: {
    id: UUIDString;
    title: string;
    imageUrl: string;
    genre?: string | null;
    reviews_on_movie: ({
      rating?: number | null;
      reviewText?: string | null;
      reviewDate: DateString;
      user: {
        id: string;
        username: string;
      } & User_Key;
    })[];
  } & Movie_Key;
}

export interface GetMovieVariables {
  id: UUIDString;
}

export interface ListMoviesData {
  movies: ({
    id: UUIDString;
    title: string;
    imageUrl: string;
    genre?: string | null;
    reviews_on_movie: ({
      rating?: number | null;
      reviewText?: string | null;
      reviewDate: DateString;
      user: {
        id: string;
        username: string;
      } & User_Key;
    })[];
  } & Movie_Key)[];
}

export interface Movie_Key {
  id: UUIDString;
  __typename?: 'Movie_Key';
}

export interface Review_Key {
  userId: string;
  movieId: UUIDString;
  __typename?: 'Review_Key';
}

export interface UpsertUserData {
  user_upsert: User_Key;
}

export interface UpsertUserVariables {
  id: string;
  username: string;
}

export interface User_Key {
  id: string;
  __typename?: 'User_Key';
}

interface ListMoviesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMoviesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMoviesData, undefined>;
  operationName: string;
}
export const listMoviesRef: ListMoviesRef;

export function listMovies(): QueryPromise<ListMoviesData, undefined>;
export function listMovies(dc: DataConnect): QueryPromise<ListMoviesData, undefined>;

interface GetMovieRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMovieVariables): QueryRef<GetMovieData, GetMovieVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMovieVariables): QueryRef<GetMovieData, GetMovieVariables>;
  operationName: string;
}
export const getMovieRef: GetMovieRef;

export function getMovie(vars: GetMovieVariables): QueryPromise<GetMovieData, GetMovieVariables>;
export function getMovie(dc: DataConnect, vars: GetMovieVariables): QueryPromise<GetMovieData, GetMovieVariables>;

interface AddReviewRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddReviewVariables): MutationRef<AddReviewData, AddReviewVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddReviewVariables): MutationRef<AddReviewData, AddReviewVariables>;
  operationName: string;
}
export const addReviewRef: AddReviewRef;

export function addReview(vars: AddReviewVariables): MutationPromise<AddReviewData, AddReviewVariables>;
export function addReview(dc: DataConnect, vars: AddReviewVariables): MutationPromise<AddReviewData, AddReviewVariables>;

interface UpsertUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
  operationName: string;
}
export const upsertUserRef: UpsertUserRef;

export function upsertUser(vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;
export function upsertUser(dc: DataConnect, vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;

interface AddMovieRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddMovieVariables): MutationRef<AddMovieData, AddMovieVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddMovieVariables): MutationRef<AddMovieData, AddMovieVariables>;
  operationName: string;
}
export const addMovieRef: AddMovieRef;

export function addMovie(vars: AddMovieVariables): MutationPromise<AddMovieData, AddMovieVariables>;
export function addMovie(dc: DataConnect, vars: AddMovieVariables): MutationPromise<AddMovieData, AddMovieVariables>;


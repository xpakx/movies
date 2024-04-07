import { ActorChain } from "./actor";

export interface Movie {
    title: String,
    director: String,
    year: number,
    img: String,
    chain?: ActorChain,
}
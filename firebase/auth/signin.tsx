import { firebase_auth } from "../config";
import { signInWithEmailAndPassword } from "firebase/auth";

interface SignInProps {
    email: string,
    password: string
}

export default async function SignIn({ email, password }: SignInProps) {
    let res = null,
        err = null;

    try {
        res = await signInWithEmailAndPassword(firebase_auth, email, password);
    } catch (e) {
        err = e;
    }

    return { res, err };
}
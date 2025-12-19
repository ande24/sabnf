import firebase_app from "../config";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";

const auth = getAuth(firebase_app);

interface SignUpProps {
    email: string, 
    password: string
}

export default async function SignUp({email, password}: SignUpProps) {
    let res = null,
        err = null;
    try {
        res = await createUserWithEmailAndPassword(auth, email, password);
    } catch (e) {
        err = e;
    }

    return { res, err };
}
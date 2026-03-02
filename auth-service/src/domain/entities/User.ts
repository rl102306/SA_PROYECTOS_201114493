import { v4 as uuidv4 } from 'uuid';

export enum UserRole {
  CLIENT = 'CLIENT',
  RESTAURANT = 'RESTAURANT',
  DELIVERY = 'DELIVERY',
  ADMIN = 'ADMIN'
}

export interface UserProps {
  id?: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  private readonly _id: string;
  private _email: string;
  private _password: string;
  private _firstName: string;
  private _lastName: string;
  private _role: UserRole;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: UserProps) {
    this._id = props.id || uuidv4();
    this._email = props.email;
    this._password = props.password;
    this._firstName = props.firstName;
    this._lastName = props.lastName;
    this._role = props.role;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get email(): string { return this._email; }
  get password(): string { return this._password; }
  get firstName(): string { return this._firstName; }
  get lastName(): string { return this._lastName; }
  get role(): UserRole { return this._role; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  updatePassword(newPassword: string): void {
    this._password = newPassword;
    this._updatedAt = new Date();
  }

  updateProfile(firstName: string, lastName: string): void {
    this._firstName = firstName;
    this._lastName = lastName;
    this._updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this._id,
      email: this._email,
      firstName: this._firstName,
      lastName: this._lastName,
      role: this._role,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}

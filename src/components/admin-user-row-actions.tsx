"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EllipsisVertical,
  Pencil,
  Shield,
  Trash2,
  UserX,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  activateAdminUser,
  deleteAdminUser,
  inactivateAdminUser,
  updateAdminUser,
} from "@/app/actions/admin";
import type { AdminUser } from "@/types/admin";
import type { UserRole } from "@/types/user";

export function AdminUserRowActions({ user }: { user: AdminUser }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inactivateOpen, setInactivateOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState<UserRole>(user.role);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAction(action: () => Promise<{ error?: string }>, onSuccess: () => void) {
    setPending(true);
    setError(null);
    const result = await action();
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    setPending(false);
    onSuccess();
    router.refresh();
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          className="outline-none"
          render={
            <Button variant="ghost" size="icon-sm" aria-label="User actions" />
          }
        >
          <EllipsisVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                setMenuOpen(false);
                setUsername(user.username);
                setEditOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                setMenuOpen(false);
                setRole(user.role);
                setRoleOpen(true);
              }}
            >
              <Shield className="h-4 w-4" />
              Change Role
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {user.active ? (
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  setMenuOpen(false);
                  setInactivateOpen(true);
                }}
              >
                <UserX className="h-4 w-4" />
                Inactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  setMenuOpen(false);
                  setActivateOpen(true);
                }}
              >
                <UserCheck className="h-4 w-4" />
                Activate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer"
              onClick={() => {
                setMenuOpen(false);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={(open) => !pending && setEditOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Update the display name for {user.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`edit-username-${user.id}`}>Username</Label>
            <Input
              id={`edit-username-${user.id}`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                runAction(
                  () => updateAdminUser({ userId: user.id, displayName: username }),
                  () => setEditOpen(false)
                )
              }
              disabled={pending || !username.trim()}
            >
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roleOpen} onOpenChange={(open) => !pending && setRoleOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              Update the role assigned to {user.username}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                runAction(
                  () => updateAdminUser({ userId: user.id, role }),
                  () => setRoleOpen(false)
                )
              }
              disabled={pending}
            >
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inactivateOpen} onOpenChange={(open) => !pending && setInactivateOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inactivate user?</DialogTitle>
            <DialogDescription>
              {user.username} will be marked inactive. They will remain in the system but
              shown as inactive.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInactivateOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                runAction(
                  () => inactivateAdminUser(user.id),
                  () => setInactivateOpen(false)
                )
              }
              disabled={pending}
            >
              {pending ? "Updating..." : "Inactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activateOpen} onOpenChange={(open) => !pending && setActivateOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate user?</DialogTitle>
            <DialogDescription>
              Restore active status for {user.username}.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                runAction(
                  () => activateAdminUser(user.id),
                  () => setActivateOpen(false)
                )
              }
              disabled={pending}
            >
              {pending ? "Updating..." : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(open) => !pending && setDeleteOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              Permanently delete {user.username} ({user.email}) and all associated data.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                runAction(
                  () => deleteAdminUser(user.id),
                  () => setDeleteOpen(false)
                )
              }
              disabled={pending}
            >
              {pending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

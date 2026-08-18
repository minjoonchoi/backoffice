"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type FormValues = {
  name: string
}

export function FormProof() {
  const t = useTranslations("proof")
  const [submitted, setSubmitted] = useState(false)
  const schema = z.object({
    name: z.string().trim().min(2, t("nameRequired")),
  })
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FormValues>({
    defaultValues: { name: "" },
    resolver: zodResolver(schema),
  })

  return (
    <form
      className="grid max-w-sm gap-4"
      noValidate
      onSubmit={handleSubmit(() => {
        setSubmitted(true)
      })}
    >
      <h2 className="text-base font-medium">{t("formTitle")}</h2>
      <div className="grid gap-2">
        <Label htmlFor="proof-name">{t("name")}</Label>
        <Input
          id="proof-name"
          aria-describedby={
            errors.name ? "proof-name-error" : "proof-name-description"
          }
          aria-invalid={Boolean(errors.name)}
          {...register("name", {
            onChange: () => {
              setSubmitted(false)
            },
          })}
        />
        {errors.name ? (
          <p
            id="proof-name-error"
            role="alert"
            className="text-xs text-destructive"
          >
            {errors.name.message}
          </p>
        ) : (
          <p
            id="proof-name-description"
            className="text-xs text-muted-foreground"
          >
            {t("nameDescription")}
          </p>
        )}
      </div>
      <Button type="submit">{t("submit")}</Button>
      {submitted ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("submitted")}
        </p>
      ) : null}
    </form>
  )
}

_n42_completions()
{
  local cur prev words cword
  _init_completion || return

  local commands="login logout me usage history discover clean"

  if [[ $cword -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
    return
  fi

  # discover peppol
  if [[ ${words[1]} == "discover" && $cword -eq 2 ]]; then
    COMPREPLY=( $(compgen -W "peppol" -- "$cur") )
    return
  fi

  # usage discovery|validation|transactions
  if [[ ${words[1]} == "usage" && $cword -eq 2 ]]; then
    COMPREPLY=( $(compgen -W "discovery validation transactions" -- "$cur") )
    return
  fi
}

complete -F _n42_completions n42